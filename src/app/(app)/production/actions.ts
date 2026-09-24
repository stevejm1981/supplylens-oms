"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAvgLandedCosts } from "@/lib/queries";
import { recordMovement } from "@/lib/stock-ledger";
import { JOURNAL_ACCOUNTS, recordStockJournal, type JournalLineInput } from "@/lib/journals";
import { nextRef } from "@/lib/settings";
import { buildCost, completionDeltas } from "@/lib/engine/production";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function revalidateProduction() {
  revalidatePath("/production");
  revalidatePath("/stock");
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath("/reports");
  revalidatePath("/replenishment");
}

/** DRAFT: plan a build. Lines snapshot from the BOM x planned quantity. */
export async function createProductionOrder(input: {
  productId: string;
  warehouseId: string;
  plannedQty: number;
  notes: string | null;
}): Promise<ActionResult> {
  if (!input.warehouseId) return { ok: false, error: "Warehouse is required" };
  if (!Number.isInteger(input.plannedQty) || input.plannedQty < 1) {
    return { ok: false, error: "Planned quantity must be a whole number of at least 1" };
  }
  const product = await db.product.findUnique({
    where: { id: input.productId },
    include: { bomLines: true },
  });
  if (!product) return { ok: false, error: "Product not found" };
  if (product.type !== "ASSEMBLED") {
    return { ok: false, error: `${product.sku} is not an assembled product` };
  }
  if (product.bomLines.length === 0) {
    return { ok: false, error: `${product.sku} has no BOM, define its components first` };
  }
  try {
    const count = await db.productionOrder.count();
    const order = await db.productionOrder.create({
      data: {
        reference: await nextRef("productionOrder", count),
        productId: product.id,
        warehouseId: input.warehouseId,
        plannedQty: input.plannedQty,
        notes: input.notes?.trim() || null,
        lines: {
          create: product.bomLines.map((bom) => ({
            componentId: bom.componentId,
            plannedQty: bom.quantity * input.plannedQty,
          })),
        },
      },
    });
    revalidateProduction();
    return { ok: true, id: order.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
}

/**
 * IN_PROGRESS: the brew goes in the tank. Components leave stock at their
 * current average landed cost (snapshotted per line) and their value moves
 * into Work in Progress.
 */
export async function startProduction(id: string): Promise<ActionResult> {
  const order = await db.productionOrder.findUnique({
    where: { id },
    include: { lines: { include: { component: true } }, warehouse: true },
  });
  if (!order) return { ok: false, error: "Production order not found" };
  if (order.status !== "DRAFT") return { ok: false, error: "Only draft builds can start" };

  const levels = await db.stockLevel.findMany({
    where: {
      warehouseId: order.warehouseId,
      productId: { in: order.lines.map((l) => l.componentId) },
    },
  });
  const onHand = new Map(levels.map((l) => [l.productId, l.quantity]));
  const short = order.lines.filter(
    (l) => (onHand.get(l.componentId) ?? 0) < l.plannedQty,
  );
  if (short.length > 0) {
    return {
      ok: false,
      error: `Not enough component stock in ${order.warehouse.name}: ${short
        .map((l) => `${l.component.sku} (need ${l.plannedQty}, have ${onHand.get(l.componentId) ?? 0})`)
        .join("; ")}`,
    };
  }

  const avgCosts = await getAvgLandedCosts();
  const unitCost = (l: (typeof order.lines)[number]) =>
    avgCosts.get(l.componentId) ?? l.component.baseCostPence;

  try {
    await db.$transaction(async (tx) => {
      let wipValue = 0;
      for (const line of order.lines) {
        const cost = unitCost(line);
        wipValue += line.plannedQty * cost;
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: line.componentId,
              warehouseId: order.warehouseId,
            },
          },
          data: { quantity: { decrement: line.plannedQty } },
        });
        await recordMovement(tx, {
          productId: line.componentId,
          warehouseId: order.warehouseId,
          quantity: -line.plannedQty,
          type: "ASSEMBLY_BUILD",
          reference: order.reference,
          referenceId: order.id,
        });
        await tx.productionOrderLine.update({
          where: { id: line.id },
          data: { unitCostPence: cost },
        });
      }
      await recordStockJournal(tx, {
        type: "PRODUCTION",
        sourceRef: order.reference,
        sourceId: order.id,
        memo: `Build started ${order.reference}: components into WIP`,
        lines: [
          { account: JOURNAL_ACCOUNTS.wip, debitPence: Math.round(wipValue) },
          { account: JOURNAL_ACCOUNTS.stock, creditPence: Math.round(wipValue) },
        ],
      });
      await tx.productionOrder.update({
        where: { id },
        data: { status: "IN_PROGRESS", startedAt: new Date() },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Start failed" };
  }
  revalidateProduction();
  return { ok: true };
}

/**
 * COMPLETED: record what really happened. Component overruns consume more
 * stock, surpluses return; finished goods enter stock and the tranche list
 * at actual value / actual units. WIP nets to zero in the same journal.
 */
export async function completeProduction(
  id: string,
  input: {
    actualQty: number;
    lines: { lineId: string; actualQty: number }[];
    overheadPence?: number;
    overheadNote?: string | null;
  },
): Promise<ActionResult> {
  const order = await db.productionOrder.findUnique({
    where: { id },
    include: { lines: { include: { component: true } }, product: true, warehouse: true },
  });
  if (!order) return { ok: false, error: "Production order not found" };
  if (order.status !== "IN_PROGRESS") {
    return { ok: false, error: "Only builds in progress can be completed" };
  }
  if (!Number.isInteger(input.actualQty) || input.actualQty < 1) {
    return { ok: false, error: "Actual quantity produced must be a whole number of at least 1" };
  }
  const actuals = new Map(input.lines.map((l) => [l.lineId, l.actualQty]));
  for (const line of order.lines) {
    const actual = actuals.get(line.id) ?? line.plannedQty;
    if (!Number.isInteger(actual) || actual < 0) {
      return { ok: false, error: `${line.component.sku}: actual consumed must be whole units, 0 or more` };
    }
  }

  const lineActual = (l: (typeof order.lines)[number]) => actuals.get(l.id) ?? l.plannedQty;
  const deltas = completionDeltas(
    order.lines.map((l) => ({
      componentId: l.componentId,
      plannedQty: l.plannedQty,
      actualQty: lineActual(l),
    })),
  );

  // Overruns need stock available now.
  const extra = deltas.filter((d) => d.delta > 0);
  if (extra.length > 0) {
    const levels = await db.stockLevel.findMany({
      where: {
        warehouseId: order.warehouseId,
        productId: { in: extra.map((d) => d.componentId) },
      },
    });
    const onHand = new Map(levels.map((l) => [l.productId, l.quantity]));
    for (const d of extra) {
      if ((onHand.get(d.componentId) ?? 0) < d.delta) {
        const sku = order.lines.find((l) => l.componentId === d.componentId)!.component.sku;
        return {
          ok: false,
          error: `${sku}: consumed ${d.delta} more than planned but only ${onHand.get(d.componentId) ?? 0} on hand`,
        };
      }
    }
  }

  const overhead = Math.round(input.overheadPence ?? 0);
  if (overhead < 0 || !Number.isFinite(overhead)) {
    return { ok: false, error: "Build costs cannot be negative" };
  }
  const finished = buildCost(
    order.lines.map((l) => ({
      componentId: l.componentId,
      actualQty: lineActual(l),
      unitCostPence: l.unitCostPence ?? 0,
    })),
    input.actualQty,
    overhead,
  );

  try {
    await db.$transaction(async (tx) => {
      const journalLines: JournalLineInput[] = [];
      for (const d of deltas) {
        const line = order.lines.find((l) => l.componentId === d.componentId)!;
        const value = Math.round(Math.abs(d.delta) * (line.unitCostPence ?? 0));
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: d.componentId,
              warehouseId: order.warehouseId,
            },
          },
          data: { quantity: d.delta > 0 ? { decrement: d.delta } : { increment: -d.delta } },
        });
        await recordMovement(tx, {
          productId: d.componentId,
          warehouseId: order.warehouseId,
          quantity: -d.delta,
          type: "ASSEMBLY_BUILD",
          reference: order.reference,
          referenceId: order.id,
          notes: d.delta > 0 ? "over plan" : "returned surplus",
        });
        if (d.delta > 0) {
          journalLines.push({ account: JOURNAL_ACCOUNTS.wip, debitPence: value });
          journalLines.push({ account: JOURNAL_ACCOUNTS.stock, creditPence: value });
        } else {
          journalLines.push({ account: JOURNAL_ACCOUNTS.stock, debitPence: value });
          journalLines.push({ account: JOURNAL_ACCOUNTS.wip, creditPence: value });
        }
      }

      for (const line of order.lines) {
        await tx.productionOrderLine.update({
          where: { id: line.id },
          data: { actualQty: lineActual(line) },
        });
      }

      // Finished goods onto the shelf.
      await tx.stockLevel.upsert({
        where: {
          productId_warehouseId: {
            productId: order.productId,
            warehouseId: order.warehouseId,
          },
        },
        create: {
          productId: order.productId,
          warehouseId: order.warehouseId,
          quantity: input.actualQty,
        },
        update: { quantity: { increment: input.actualQty } },
      });
      await recordMovement(tx, {
        productId: order.productId,
        warehouseId: order.warehouseId,
        quantity: input.actualQty,
        type: "ASSEMBLY_BUILD",
        reference: order.reference,
        referenceId: order.id,
      });
      journalLines.push({ account: JOURNAL_ACCOUNTS.stock, debitPence: finished.totalValuePence });
      journalLines.push({ account: JOURNAL_ACCOUNTS.wip, creditPence: finished.componentValuePence });
      if (finished.overheadPence > 0) {
        journalLines.push({
          account: JOURNAL_ACCOUNTS.overheadAbsorbed,
          creditPence: finished.overheadPence,
          description: input.overheadNote?.trim() || "Build costs absorbed",
        });
      }
      await recordStockJournal(tx, {
        type: "PRODUCTION",
        sourceRef: order.reference,
        sourceId: order.id,
        memo: `Build completed ${order.reference}: ${input.actualQty} x ${order.product.sku} at actual cost`,
        lines: journalLines,
      });

      await tx.productionOrder.update({
        where: { id },
        data: {
          status: "COMPLETED",
          actualQty: input.actualQty,
          overheadPence: overhead,
          overheadNote: input.overheadNote?.trim() || null,
          completedAt: new Date(),
        },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Completion failed" };
  }
  revalidateProduction();
  return { ok: true };
}

export async function deleteProductionOrder(id: string): Promise<ActionResult> {
  const order = await db.productionOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Production order not found" };
  if (order.status !== "DRAFT") {
    return {
      ok: false,
      error: "Only draft builds can be deleted, an in-progress or completed build is history",
    };
  }
  await db.productionOrder.delete({ where: { id } });
  revalidateProduction();
  return { ok: true };
}
