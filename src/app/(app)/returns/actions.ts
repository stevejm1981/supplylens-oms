"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { orderTotalsPence, effectiveUnitPricePence } from "@/lib/sales";
import { recordMovement } from "@/lib/stock-ledger";
import { getAvgLandedCosts } from "@/lib/queries";
import { JOURNAL_ACCOUNTS, recordStockJournal } from "@/lib/journals";
import { nextRef } from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateReturns(orderId?: string) {
  revalidatePath("/returns");
  revalidatePath("/movements");
  revalidatePath("/stock");
  revalidatePath("/credits");
  revalidatePath("/reports");
  revalidatePath("/products");
  revalidatePath("/warehouses");
  if (orderId) revalidatePath(`/sales-orders/${orderId}`);
}

// ── Customer returns (RMA) ──────────────────────────────────────────────────

export async function createCustomerReturn(input: {
  salesOrderId: string;
  warehouseId: string;
  reason: string | null;
  lines: { orderLineId: string; quantity: number }[];
}): Promise<ActionResult> {
  const order = await db.salesOrder.findUnique({
    where: { id: input.salesOrderId },
    include: {
      lines: { include: { despatchLines: true, returnLines: true, product: true } },
    },
  });
  if (!order) return { ok: false, error: "Sales order not found" };
  const requested = input.lines.filter((l) => l.quantity > 0);
  if (requested.length === 0) {
    return { ok: false, error: "Enter a quantity on at least one line" };
  }
  for (const req of requested) {
    const line = order.lines.find((l) => l.id === req.orderLineId);
    if (!line) return { ok: false, error: "Line does not match the order" };
    const despatched = line.despatchLines.reduce((s, d) => s + d.despatchedQty, 0);
    const alreadyReturning = line.returnLines.reduce((s, r) => s + r.quantity, 0);
    const returnable = despatched - alreadyReturning;
    if (!Number.isInteger(req.quantity) || req.quantity > returnable) {
      return {
        ok: false,
        error: `${line.product.sku}: only ${returnable} returnable (despatched ${despatched}, already on returns ${alreadyReturning})`,
      };
    }
  }
  try {
    const count = await db.customerReturn.count();
    await db.salesOrder.update({
      where: { id: order.id },
      data: { updatedAt: new Date() },
    });
    await db.customerReturn.create({
      data: {
        reference: await nextRef("customerReturn", count),
        salesOrderId: order.id,
        warehouseId: input.warehouseId,
        reason: input.reason?.trim() || null,
        lines: { create: requested },
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
  revalidateReturns(order.id);
  return { ok: true };
}

/**
 * Receive the RMA: triage each line into restock (back into stock, ledger
 * entry, COGS reverses) vs write-off (binned, refund only). Auto-raises the
 * financial credit note for everything that came back, under the order's tax
 * treatment.
 */
export async function receiveCustomerReturn(
  id: string,
  triage: { returnLineId: string; restockQty: number; writeOffQty: number }[],
): Promise<ActionResult> {
  const rma = await db.customerReturn.findUnique({
    where: { id },
    include: {
      lines: { include: { orderLine: { include: { product: { include: { bomLines: true } } } } } },
      salesOrder: true,
    },
  });
  if (!rma) return { ok: false, error: "Return not found" };
  if (rma.status !== "AWAITING") {
    return { ok: false, error: "This return has already been received" };
  }
  for (const line of rma.lines) {
    const t = triage.find((x) => x.returnLineId === line.id);
    const restock = t?.restockQty ?? 0;
    const writeOff = t?.writeOffQty ?? 0;
    if (
      !Number.isInteger(restock) ||
      !Number.isInteger(writeOff) ||
      restock < 0 ||
      writeOff < 0 ||
      restock + writeOff > line.quantity
    ) {
      return {
        ok: false,
        error: `${line.orderLine.product.sku}: restock + write-off must total at most ${line.quantity}`,
      };
    }
  }
  const totalBack = triage.reduce((s, t) => s + t.restockQty + t.writeOffQty, 0);
  if (totalBack === 0) {
    return { ok: false, error: "Nothing received, enter restock or write-off quantities" };
  }

  // Credit value: everything that came back, at the discounted price paid.
  const creditLines = rma.lines
    .map((line) => {
      const t = triage.find((x) => x.returnLineId === line.id);
      const qty = (t?.restockQty ?? 0) + (t?.writeOffQty ?? 0);
      return {
        productId: line.orderLine.productId,
        quantity: qty,
        unitsPerUom: line.orderLine.unitsPerUom,
        unitPricePence: Math.round(effectiveUnitPricePence(line.orderLine)),
        unitCogsPence: line.orderLine.unitCogsPence,
      };
    })
    .filter((l) => l.quantity > 0);
  const { netPence, vatPence, grossPence } = orderTotalsPence(
    creditLines,
    0,
    rma.salesOrder.taxTreatment,
  );

  try {
    const crnCount = await db.creditNote.count();
    const crnNumber = await nextRef("creditNote", crnCount);
    await db.$transaction(async (tx) => {
      for (const line of rma.lines) {
        const t = triage.find((x) => x.returnLineId === line.id);
        const restock = t?.restockQty ?? 0;
        const writeOff = t?.writeOffQty ?? 0;
        await tx.customerReturnLine.update({
          where: { id: line.id },
          data: {
            restockQty: restock,
            writeOffQty: writeOff,
            unitCogsPence: line.orderLine.unitCogsPence,
          },
        });
        if (restock > 0) {
          // Bundles come back as their components, packs as their base units,
          // mirroring despatch exactly.
          const product = line.orderLine.product;
          const returned =
            product.type === "BUNDLE"
              ? product.bomLines.map((b) => [b.componentId, b.quantity * restock] as const)
              : ([[line.orderLine.productId, restock * line.orderLine.unitsPerUom]] as const);
          for (const [productId, qty] of returned) {
            await tx.stockLevel.upsert({
              where: {
                productId_warehouseId: { productId, warehouseId: rma.warehouseId },
              },
              create: { productId, warehouseId: rma.warehouseId, quantity: qty },
              update: { quantity: { increment: qty } },
            });
            await recordMovement(tx, {
              productId,
              warehouseId: rma.warehouseId,
              quantity: qty,
              type: "CUSTOMER_RETURN",
              reference: rma.reference,
              referenceId: rma.salesOrderId,
            });
          }
        }
      }
      // Accounting shadow: restocked goods come back onto the balance sheet
      // at their despatch COGS; write-offs stay spent (no journal for them).
      const restockValue = rma.lines.reduce((s, line) => {
        const t = triage.find((x) => x.returnLineId === line.id);
        return s + (t?.restockQty ?? 0) * (line.orderLine.unitCogsPence ?? 0);
      }, 0);
      await recordStockJournal(tx, {
        type: "RETURN_RESTOCK",
        sourceRef: rma.reference,
        sourceId: rma.id,
        memo: `Customer return ${rma.reference} restocked`,
        lines: [
          { account: JOURNAL_ACCOUNTS.stock, debitPence: Math.round(restockValue) },
          { account: JOURNAL_ACCOUNTS.cogs, creditPence: Math.round(restockValue) },
        ],
      });
      const credit = await tx.creditNote.create({
        data: {
          number: crnNumber,
          salesOrderId: rma.salesOrderId,
          reason: `Customer return ${rma.reference}${rma.reason ? `, ${rma.reason}` : ""}`,
          restock: false, // stock handled by the RMA; this credit is money only
          netPence,
          vatPence,
          grossPence,
          lines: { create: creditLines },
        },
      });
      await tx.customerReturn.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date(), creditNoteId: credit.id },
      });
      await tx.salesOrder.update({
        where: { id: rma.salesOrderId },
        data: { updatedAt: new Date() },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Receive failed" };
  }
  revalidateReturns(rma.salesOrderId);
  return { ok: true };
}

export async function deleteCustomerReturn(id: string): Promise<ActionResult> {
  const rma = await db.customerReturn.findUnique({ where: { id } });
  if (!rma) return { ok: false, error: "Return not found" };
  if (rma.status !== "AWAITING") {
    return { ok: false, error: "Received returns cannot be deleted" };
  }
  await db.customerReturn.delete({ where: { id } });
  revalidateReturns(rma.salesOrderId);
  return { ok: true };
}

// ── Supplier returns (RTV) ──────────────────────────────────────────────────

export async function createSupplierReturn(input: {
  supplierId: string;
  warehouseId: string;
  reason: string | null;
  lines: { productId: string; quantity: number; unitCostPence: number }[];
}): Promise<ActionResult> {
  if (!input.supplierId) return { ok: false, error: "Supplier is required" };
  if (!input.warehouseId) return { ok: false, error: "Warehouse is required" };
  const lines = input.lines.filter((l) => l.productId && l.quantity > 0);
  if (lines.length === 0) {
    return { ok: false, error: "At least one line with a quantity is required" };
  }
  try {
    const count = await db.supplierReturn.count();
    await db.supplierReturn.create({
      data: {
        reference: await nextRef("supplierReturn", count),
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        reason: input.reason?.trim() || null,
        lines: { create: lines },
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
  revalidateReturns();
  return { ok: true };
}

/** Send the RTV: stock leaves the warehouse, ledger entries written. */
export async function sendSupplierReturn(id: string): Promise<ActionResult> {
  const rtv = await db.supplierReturn.findUnique({
    where: { id },
    include: { lines: { include: { product: true } }, warehouse: true },
  });
  if (!rtv) return { ok: false, error: "Supplier return not found" };
  if (rtv.status !== "DRAFT") return { ok: false, error: "Already sent" };

  const levels = await db.stockLevel.findMany({
    where: { warehouseId: rtv.warehouseId, productId: { in: rtv.lines.map((l) => l.productId) } },
  });
  const available = new Map(levels.map((l) => [l.productId, l.quantity]));
  for (const line of rtv.lines) {
    const have = available.get(line.productId) ?? 0;
    if (have < line.quantity) {
      return {
        ok: false,
        error: `Not enough stock in ${rtv.warehouse.name}: ${line.product.sku} (need ${line.quantity}, have ${have})`,
      };
    }
  }
  const avgCosts = await getAvgLandedCosts();
  try {
    await db.$transaction(async (tx) => {
      for (const line of rtv.lines) {
        await tx.stockLevel.update({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId: rtv.warehouseId },
          },
          data: { quantity: { decrement: line.quantity } },
        });
        await recordMovement(tx, {
          productId: line.productId,
          warehouseId: rtv.warehouseId,
          quantity: -line.quantity,
          type: "SUPPLIER_RETURN",
          reference: rtv.reference,
          referenceId: null,
        });
      }
      // Financials: goods leave the balance sheet at what they really cost
      // (average landed); the expected supplier credit sits in Supplier
      // Credits Due until their credit note arrives in the ledger app.
      const stockValue = Math.round(
        rtv.lines.reduce(
          (s, l) => s + l.quantity * (avgCosts.get(l.productId) ?? l.unitCostPence),
          0,
        ),
      );
      await recordStockJournal(tx, {
        type: "SUPPLIER_RETURN",
        sourceRef: rtv.reference,
        sourceId: rtv.id,
        memo: `Supplier return ${rtv.reference} sent`,
        lines: [
          { account: JOURNAL_ACCOUNTS.supplierCredits, debitPence: stockValue },
          { account: JOURNAL_ACCOUNTS.stock, creditPence: stockValue },
        ],
      });
      await tx.supplierReturn.update({
        where: { id },
        data: { status: "SENT", sentAt: new Date() },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
  revalidateReturns();
  return { ok: true };
}

export async function deleteSupplierReturn(id: string): Promise<ActionResult> {
  const rtv = await db.supplierReturn.findUnique({ where: { id } });
  if (!rtv) return { ok: false, error: "Supplier return not found" };
  if (rtv.status !== "DRAFT") {
    return { ok: false, error: "Sent returns cannot be deleted, the goods have gone" };
  }
  await db.supplierReturn.delete({ where: { id } });
  revalidateReturns();
  return { ok: true };
}
