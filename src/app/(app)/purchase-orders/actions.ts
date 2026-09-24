"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recordMovement } from "@/lib/stock-ledger";
import { JOURNAL_ACCOUNTS, recordStockJournal } from "@/lib/journals";
import { nextRef } from "@/lib/settings";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export interface NewPoLine {
  productId: string;
  quantity: number;
  unitCostPence: number;
}

export async function createPurchaseOrder(input: {
  supplierId: string;
  containerRef: string | null;
  expectedDate: string | null;
  notes: string | null;
  lines: NewPoLine[];
}): Promise<ActionResult> {
  if (!input.supplierId) return { ok: false, error: "Supplier is required" };
  const lines = input.lines.filter((l) => l.productId && l.quantity > 0);
  if (lines.length === 0) {
    return { ok: false, error: "At least one line with a quantity is required" };
  }
  try {
    const count = await db.purchaseOrder.count();
    const po = await db.purchaseOrder.create({
      data: {
        reference: await nextRef("purchaseOrder", count),
        supplierId: input.supplierId,
        containerRef: input.containerRef?.trim() || null,
        expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
        notes: input.notes?.trim() || null,
        lines: { create: lines },
      },
    });
    revalidatePath("/purchase-orders");
    return { ok: true, id: po.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
}

export async function placePurchaseOrder(id: string): Promise<ActionResult> {
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po) return { ok: false, error: "Purchase order not found" };
  if (po.status !== "DRAFT") {
    return { ok: false, error: "Only draft orders can be placed" };
  }
  await db.purchaseOrder.update({
    where: { id },
    data: { status: "PLACED", placedAt: new Date() },
  });
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true };
}

export async function receivePurchaseOrder(
  id: string,
  warehouseId: string,
): Promise<ActionResult> {
  const warehouse = await db.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return { ok: false, error: "Choose a warehouse to receive into" };
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: { include: { allocations: true } } },
  });
  if (!po) return { ok: false, error: "Purchase order not found" };
  if (po.status !== "PLACED") {
    return { ok: false, error: "Only placed orders can be received" };
  }
  try {
    await db.$transaction(async (tx) => {
      for (const line of po.lines) {
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId },
          },
          create: { productId: line.productId, warehouseId, quantity: line.quantity },
          update: { quantity: { increment: line.quantity } },
        });
        await recordMovement(tx, {
          productId: line.productId,
          warehouseId,
          quantity: line.quantity,
          type: "PO_RECEIPT",
          reference: po.reference,
          referenceId: po.id,
        });
      }
      // Activate inbound holds in the SAME transaction as the receipt, there is
      // no window where the landed stock is visible to channels before the hold.
      await tx.stockReservation.updateMany({
        where: { purchaseOrderId: id, status: "PENDING" },
        data: { status: "ACTIVE", warehouseId },
      });
      // Accounting shadow: stock onto the balance sheet at PO cost. (Landed
      // cost invoices arriving later re-price averages, not this journal.)
      // Goods at PO cost PLUS any landed costs already allocated to these
      // lines, so pre-receipt freight bills land on the balance sheet exactly
      // once (post-receipt ones journal at allocation time instead).
      const receiptValue = po.lines.reduce(
        (s, l) =>
          s + l.quantity * l.unitCostPence + l.allocations.reduce((x, a) => x + a.amountPence, 0),
        0,
      );
      await recordStockJournal(tx, {
        type: "PO_RECEIPT",
        sourceRef: po.reference,
        sourceId: po.id,
        memo: `Goods received ${po.reference} into ${warehouse.name}`,
        lines: [
          { account: JOURNAL_ACCOUNTS.stock, debitPence: receiptValue },
          { account: JOURNAL_ACCOUNTS.grni, creditPence: receiptValue },
        ],
      });
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: "RECEIVED", receivedAt: new Date() },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Receive failed" };
  }
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath("/movements");
  revalidatePath("/reservations");
  revalidatePath("/channels");
  return { ok: true };
}

export async function deletePurchaseOrder(id: string): Promise<ActionResult> {
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { costInvoices: true },
  });
  if (!po) return { ok: false, error: "Purchase order not found" };
  if (po.status === "RECEIVED") {
    return { ok: false, error: "Received orders cannot be deleted" };
  }
  if (po.costInvoices.length > 0) {
    return { ok: false, error: "Detach cost invoices before deleting" };
  }
  await db.purchaseOrder.delete({ where: { id } });
  revalidatePath("/purchase-orders");
  return { ok: true };
}
