"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAvgLandedCosts } from "@/lib/queries";
import { recordMovement } from "@/lib/stock-ledger";
import { JOURNAL_ACCOUNTS, recordStockJournal } from "@/lib/journals";
import { nextRef } from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateStockDocs() {
  revalidatePath("/adjustments");
  revalidatePath("/transfers");
  revalidatePath("/stock");
  revalidatePath("/movements");
  revalidatePath("/products");
  revalidatePath("/warehouses");
  revalidatePath("/reports");
}

/**
 * Stock adjustment, stocktake variances, damage, shrinkage. Applied
 * immediately and irreversibly: the document IS the audit trail, so a mistake
 * is corrected by a counter-adjustment, never by deleting history.
 */
export async function createAdjustment(input: {
  warehouseId: string;
  reason: string;
  notes: string | null;
  lines: { productId: string; quantityDelta: number }[];
}): Promise<ActionResult> {
  if (!input.warehouseId) return { ok: false, error: "Warehouse is required" };
  if (!input.reason.trim()) {
    return { ok: false, error: "A reason is required, adjustments are permanent audit records" };
  }
  const lines = input.lines.filter((l) => l.productId && l.quantityDelta !== 0);
  if (lines.length === 0) {
    return { ok: false, error: "Enter a non-zero quantity on at least one line" };
  }
  if (lines.some((l) => !Number.isInteger(l.quantityDelta))) {
    return { ok: false, error: "Quantities must be whole units (± delta)" };
  }
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.productId)) return { ok: false, error: "Each product can appear only once" };
    seen.add(l.productId);
  }

  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
    select: { id: true, sku: true, type: true },
  });
  const bySku = new Map(products.map((p) => [p.id, p.sku]));
  const bundle = products.find((p) => p.type === "BUNDLE");
  if (bundle) {
    return { ok: false, error: `${bundle.sku} is a bundle, adjust its components instead` };
  }

  // Negative deltas can't take a level below zero.
  const levels = await db.stockLevel.findMany({
    where: { warehouseId: input.warehouseId, productId: { in: lines.map((l) => l.productId) } },
  });
  const onHand = new Map(levels.map((l) => [l.productId, l.quantity]));
  for (const l of lines) {
    const have = onHand.get(l.productId) ?? 0;
    if (have + l.quantityDelta < 0) {
      return {
        ok: false,
        error: `${bySku.get(l.productId)}: only ${have} on hand, cannot adjust by ${l.quantityDelta}`,
      };
    }
  }

  const avgCosts = await getAvgLandedCosts();
  const baseCosts = new Map(
    (
      await db.product.findMany({
        where: { id: { in: lines.map((l) => l.productId) } },
        select: { id: true, baseCostPence: true },
      })
    ).map((p) => [p.id, p.baseCostPence]),
  );
  const unitValue = (productId: string) =>
    avgCosts.get(productId) ?? baseCosts.get(productId) ?? 0;

  try {
    const count = await db.stockAdjustment.count();
    const reference = await nextRef("adjustment", count);
    await db.$transaction(async (tx) => {
      const doc = await tx.stockAdjustment.create({
        data: {
          reference,
          warehouseId: input.warehouseId,
          reason: input.reason.trim(),
          notes: input.notes?.trim() || null,
          lines: { create: lines },
        },
      });
      for (const l of lines) {
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: { productId: l.productId, warehouseId: input.warehouseId },
          },
          create: {
            productId: l.productId,
            warehouseId: input.warehouseId,
            quantity: l.quantityDelta,
          },
          update: { quantity: { increment: l.quantityDelta } },
        });
        await recordMovement(tx, {
          productId: l.productId,
          warehouseId: input.warehouseId,
          quantity: l.quantityDelta,
          type: "ADJUSTMENT",
          reference,
          referenceId: doc.id,
          notes: input.reason.trim(),
        });
      }
      // Accounting shadow at average landed cost: found stock debits the
      // balance sheet, losses hit the adjustments expense account.
      const gains = lines
        .filter((l) => l.quantityDelta > 0)
        .reduce((s, l) => s + l.quantityDelta * unitValue(l.productId), 0);
      const losses = lines
        .filter((l) => l.quantityDelta < 0)
        .reduce((s, l) => s + -l.quantityDelta * unitValue(l.productId), 0);
      await recordStockJournal(tx, {
        type: "ADJUSTMENT",
        sourceRef: reference,
        sourceId: doc.id,
        memo: `${reference}: ${input.reason.trim()}`,
        lines: [
          { account: JOURNAL_ACCOUNTS.stock, debitPence: Math.round(gains), description: "Stock found" },
          { account: JOURNAL_ACCOUNTS.adjustments, creditPence: Math.round(gains), description: "Stock found" },
          { account: JOURNAL_ACCOUNTS.adjustments, debitPence: Math.round(losses), description: "Stock lost/damaged" },
          { account: JOURNAL_ACCOUNTS.stock, creditPence: Math.round(losses), description: "Stock lost/damaged" },
        ],
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Adjustment failed" };
  }
  revalidateStockDocs();
  return { ok: true };
}

/**
 * Warehouse transfer, stock moves between warehouses in one transaction:
 * a TRANSFER out at the source, a TRANSFER in at the destination, one
 * reference tying the pair together in the ledger.
 */
export async function createTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes: string | null;
  lines: { productId: string; quantity: number }[];
}): Promise<ActionResult> {
  if (!input.fromWarehouseId || !input.toWarehouseId) {
    return { ok: false, error: "Both warehouses are required" };
  }
  if (input.fromWarehouseId === input.toWarehouseId) {
    return { ok: false, error: "Source and destination must differ" };
  }
  const lines = input.lines.filter((l) => l.productId && l.quantity > 0);
  if (lines.length === 0) {
    return { ok: false, error: "Enter a quantity on at least one line" };
  }
  if (lines.some((l) => !Number.isInteger(l.quantity))) {
    return { ok: false, error: "Quantities must be whole units" };
  }
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.productId)) return { ok: false, error: "Each product can appear only once" };
    seen.add(l.productId);
  }

  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
    select: { id: true, sku: true, type: true },
  });
  const bySku = new Map(products.map((p) => [p.id, p.sku]));
  const bundle = products.find((p) => p.type === "BUNDLE");
  if (bundle) {
    return { ok: false, error: `${bundle.sku} is a bundle, transfer its components instead` };
  }

  const levels = await db.stockLevel.findMany({
    where: { warehouseId: input.fromWarehouseId, productId: { in: lines.map((l) => l.productId) } },
  });
  const onHand = new Map(levels.map((l) => [l.productId, l.quantity]));
  for (const l of lines) {
    const have = onHand.get(l.productId) ?? 0;
    if (have < l.quantity) {
      return {
        ok: false,
        error: `${bySku.get(l.productId)}: only ${have} on hand at the source, cannot transfer ${l.quantity}`,
      };
    }
  }

  try {
    const count = await db.warehouseTransfer.count();
    const reference = await nextRef("transfer", count);
    await db.$transaction(async (tx) => {
      const doc = await tx.warehouseTransfer.create({
        data: {
          reference,
          fromWarehouseId: input.fromWarehouseId,
          toWarehouseId: input.toWarehouseId,
          notes: input.notes?.trim() || null,
          lines: { create: lines },
        },
      });
      for (const l of lines) {
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: {
              productId: l.productId,
              warehouseId: input.fromWarehouseId,
            },
          },
          data: { quantity: { decrement: l.quantity } },
        });
        await recordMovement(tx, {
          productId: l.productId,
          warehouseId: input.fromWarehouseId,
          quantity: -l.quantity,
          type: "TRANSFER",
          reference,
          referenceId: doc.id,
        });
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: l.productId,
              warehouseId: input.toWarehouseId,
            },
          },
          create: {
            productId: l.productId,
            warehouseId: input.toWarehouseId,
            quantity: l.quantity,
          },
          update: { quantity: { increment: l.quantity } },
        });
        await recordMovement(tx, {
          productId: l.productId,
          warehouseId: input.toWarehouseId,
          quantity: l.quantity,
          type: "TRANSFER",
          reference,
          referenceId: doc.id,
        });
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Transfer failed" };
  }
  revalidateStockDocs();
  return { ok: true };
}
