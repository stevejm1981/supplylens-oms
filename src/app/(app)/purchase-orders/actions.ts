"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { recordMovement } from "@/lib/stock-ledger";
import { JOURNAL_ACCOUNTS, recordStockJournal } from "@/lib/journals";
import { nextRef } from "@/lib/settings";
import { receiptProgress } from "@/lib/engine/fefo";

export type ActionResult =
  | { ok: true; id?: string; reference?: string; status?: string }
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

export interface GoodsReceiptLineInput {
  poLineId: string;
  quantity: number; // base units arriving in THIS delivery
  batchRef?: string | null; // required for batch-tracked products (defaults to the GRN reference)
  bestBefore?: string | null; // "yyyy-mm-dd", batch-tracked products only
}

/**
 * Receive one physical delivery against a purchase order. Partial deliveries
 * are the normal case: each call creates a GoodsReceipt document, moves only
 * this delivery's stock (ledgered, with batches for tracked products), puts
 * only this delivery's value onto the balance sheet, and walks the PO through
 * PLACED → PARTIALLY_RECEIVED → RECEIVED via the receipt-progress engine.
 */
export async function receiveGoodsReceipt(input: {
  poId: string;
  warehouseId: string;
  notes?: string | null;
  source?: "UI" | "API"; // provenance, defaults UI
  lines: GoodsReceiptLineInput[];
}): Promise<ActionResult> {
  const warehouse = await db.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) return { ok: false, error: "Choose a warehouse to receive into" };
  const po = await db.purchaseOrder.findUnique({
    where: { id: input.poId },
    include: {
      lines: {
        include: {
          allocations: true,
          product: { select: { batchTracked: true, sku: true } },
        },
      },
      receipts: { include: { lines: true } },
    },
  });
  if (!po) return { ok: false, error: "Purchase order not found" };
  if (po.status !== "PLACED" && po.status !== "PARTIALLY_RECEIVED") {
    return { ok: false, error: "Only placed or part-received orders can be received" };
  }
  const poLineById = new Map(po.lines.map((l) => [l.id, l]));
  const lines = input.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) return { ok: false, error: "Nothing to receive" };
  for (const l of lines) {
    const poLine = poLineById.get(l.poLineId);
    if (!poLine) return { ok: false, error: "Line does not belong to this purchase order" };
    if (!Number.isInteger(l.quantity)) return { ok: false, error: "Quantities must be whole numbers" };
  }

  let grnReference = "";
  let poStatus = po.status;
  try {
    await db.$transaction(async (tx) => {
      const count = await tx.goodsReceipt.count();
      const reference = await nextRef("goodsReceipt", count, tx);
      grnReference = reference;
      const receipt = await tx.goodsReceipt.create({
        data: {
          reference,
          poId: po.id,
          warehouseId: input.warehouseId,
          notes: input.notes?.trim() || null,
          source: input.source ?? "UI",
        },
      });

      let receiptValue = 0;
      for (const l of lines) {
        const poLine = poLineById.get(l.poLineId)!;

        // Batch identity for tracked products: the operator's reference, or
        // the GRN reference when none was given (receive-all paths). The
        // best-before sticks from the batch's first sighting.
        let batchId: string | null = null;
        if (poLine.product.batchTracked) {
          const batchRef = l.batchRef?.trim() || reference;
          const batch = await tx.stockBatch.upsert({
            where: { productId_batchRef: { productId: poLine.productId, batchRef } },
            create: {
              productId: poLine.productId,
              batchRef,
              bestBefore: l.bestBefore ? new Date(l.bestBefore) : null,
              sourceType: "PO_RECEIPT",
              sourceRef: reference,
            },
            update: {},
          });
          batchId = batch.id;
        }

        await tx.goodsReceiptLine.create({
          data: {
            receiptId: receipt.id,
            poLineId: poLine.id,
            productId: poLine.productId,
            quantity: l.quantity,
            batchId,
          },
        });
        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: poLine.productId,
              warehouseId: input.warehouseId,
            },
          },
          create: {
            productId: poLine.productId,
            warehouseId: input.warehouseId,
            quantity: l.quantity,
          },
          update: { quantity: { increment: l.quantity } },
        });
        await recordMovement(tx, {
          productId: poLine.productId,
          warehouseId: input.warehouseId,
          quantity: l.quantity,
          type: "PO_RECEIPT",
          reference,
          referenceId: po.id,
          batchId,
          notes: `${po.reference}`,
        });

        // This delivery's share of value: goods at PO cost plus the per-unit
        // share of landed costs already allocated to the line, so pre-receipt
        // freight reaches the balance sheet exactly once across deliveries
        // (post-receipt allocations journal their received share themselves).
        const allocated = poLine.allocations.reduce((s, a) => s + a.amountPence, 0);
        const perUnitShare = poLine.quantity > 0 ? allocated / poLine.quantity : 0;
        receiptValue += l.quantity * poLine.unitCostPence + Math.round(l.quantity * perUnitShare);
      }

      // Activate inbound holds in the SAME transaction as the first receipt,
      // there is no window where landed stock is visible to channels before
      // the hold (later deliveries find nothing PENDING, so this fires once).
      await tx.stockReservation.updateMany({
        where: { purchaseOrderId: po.id, status: "PENDING" },
        data: { status: "ACTIVE", warehouseId: input.warehouseId },
      });

      await recordStockJournal(tx, {
        type: "PO_RECEIPT",
        sourceRef: reference,
        sourceId: po.id,
        memo: `Goods received ${reference} (${po.reference}) into ${warehouse.name}`,
        lines: [
          { account: JOURNAL_ACCOUNTS.stock, debitPence: receiptValue },
          { account: JOURNAL_ACCOUNTS.grni, creditPence: receiptValue },
        ],
      });

      const priorLines = po.receipts.flatMap((r) => r.lines);
      const progress = receiptProgress(
        po.lines.map((l) => ({ id: l.id, quantity: l.quantity })),
        [
          ...priorLines.map((r) => ({ poLineId: r.poLineId, quantity: r.quantity })),
          ...lines.map((l) => ({ poLineId: l.poLineId, quantity: l.quantity })),
        ],
      );
      poStatus = progress.status;
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: progress.status,
          ...(progress.status === "RECEIVED" ? { receivedAt: new Date() } : {}),
        },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Receive failed" };
  }
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${input.poId}`);
  revalidatePath("/goods-in-station");
  revalidatePath("/stock");
  revalidatePath("/products");
  revalidatePath("/movements");
  revalidatePath("/reservations");
  revalidatePath("/channels");
  return { ok: true, reference: grnReference, status: poStatus };
}

/** Receive everything still outstanding in one delivery (the PO page button). */
export async function receivePurchaseOrder(
  id: string,
  warehouseId: string,
  source: "UI" | "API" = "UI",
): Promise<ActionResult> {
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { lines: true, receipts: { include: { lines: true } } },
  });
  if (!po) return { ok: false, error: "Purchase order not found" };
  const progress = receiptProgress(
    po.lines.map((l) => ({ id: l.id, quantity: l.quantity })),
    po.receipts.flatMap((r) => r.lines.map((x) => ({ poLineId: x.poLineId, quantity: x.quantity }))),
  );
  const lines = po.lines
    .map((l) => ({ poLineId: l.id, quantity: progress.outstandingByLine.get(l.id) ?? 0 }))
    .filter((l) => l.quantity > 0);
  if (lines.length === 0) return { ok: false, error: "Nothing left to receive" };
  return receiveGoodsReceipt({ poId: id, warehouseId, lines, source });
}

export async function deletePurchaseOrder(id: string): Promise<ActionResult> {
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { costInvoices: true },
  });
  if (!po) return { ok: false, error: "Purchase order not found" };
  if (po.status === "RECEIVED" || po.status === "PARTIALLY_RECEIVED") {
    return { ok: false, error: "Orders with received stock cannot be deleted" };
  }
  if (po.costInvoices.length > 0) {
    return { ok: false, error: "Detach cost invoices before deleting" };
  }
  await db.purchaseOrder.delete({ where: { id } });
  revalidatePath("/purchase-orders");
  return { ok: true };
}

/**
 * Mark a delivery's supplier invoice as billed by hand (the manual path
 * for vendors outside the ledger sync). The API ack does the same thing
 * with the ledger app's bill id.
 */
export async function markReceiptBilled(
  receiptId: string,
  billed: boolean,
): Promise<ActionResult> {
  const receipt = await db.goodsReceipt.findUnique({ where: { id: receiptId } });
  if (!receipt) return { ok: false, error: "Delivery not found" };
  await db.goodsReceipt.update({
    where: { id: receiptId },
    data: billed
      ? { billedAt: new Date() }
      : { billedAt: null, billExternalRef: null },
  });
  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${receipt.poId}`);
  return { ok: true };
}
