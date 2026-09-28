// One GRN as the ledger integration sees it: everything needed to raise
// the DRAFT supplier bill coded to GRNI (the three-way match), plus its
// billed state. Values reconcile to the booked PO_RECEIPT journal to the
// penny: goodsValue = qty x PO unit cost; landedShare = journal total
// minus goodsValue (this delivery's share of PRE-receipt landed costs,
// which the receipt journal credited to GRNI alongside the goods).

import { db } from "@/lib/db";
import { JOURNAL_ACCOUNTS } from "@/lib/journals";

export const receiptInclude = {
  warehouse: { select: { code: true } },
  purchaseOrder: { include: { supplier: { select: { code: true, name: true } } } },
  lines: { include: { product: { select: { sku: true, name: true } }, poLine: true, batch: true } },
} as const;

type ReceiptRecord = NonNullable<
  Awaited<ReturnType<typeof db.goodsReceipt.findFirst<{ include: typeof receiptInclude }>>>
>;

export function serializeReceipt(
  receipt: ReceiptRecord,
  journal: { reference: string; totalPence: number } | null,
) {
  const lines = receipt.lines.map((l) => ({
    sku: l.product.sku,
    name: l.product.name,
    quantityBase: l.quantity,
    unitCostPence: l.poLine.unitCostPence,
    goodsValuePence: l.quantity * l.poLine.unitCostPence,
    batch: l.batch ? { ref: l.batch.batchRef, bestBefore: l.batch.bestBefore } : null,
  }));
  const goodsValuePence = lines.reduce((s, l) => s + l.goodsValuePence, 0);
  const landedSharePence = journal ? journal.totalPence - goodsValuePence : 0;
  return {
    reference: receipt.reference,
    updatedAt: receipt.updatedAt,
    receivedAt: receipt.receivedAt,
    source: receipt.source,
    warehouse: receipt.warehouse.code,
    purchaseOrder: receipt.purchaseOrder.reference,
    supplier: {
      code: receipt.purchaseOrder.supplier.code,
      name: receipt.purchaseOrder.supplier.name,
    },
    currency: receipt.purchaseOrder.currency,
    lines,
    totals: {
      goodsValuePence,
      landedSharePence,
      totalPence: journal?.totalPence ?? goodsValuePence,
    },
    journal: journal?.reference ?? null,
    // Code the draft bill here; the goods bill clears it at goods value,
    // any pre-receipt freight vendor's bill clears the landed share.
    suggestedAccount: JOURNAL_ACCOUNTS.grni,
    billing: {
      status: receipt.billedAt ? "BILLED" : "UNBILLED",
      billedAt: receipt.billedAt,
      externalRef: receipt.billExternalRef,
    },
    notes: receipt.notes,
  };
}

/** PO_RECEIPT journals keyed by their GRN reference (sourceRef). */
export async function journalsByReceiptRef(refs: string[]) {
  const journals = await db.stockJournal.findMany({
    where: { type: "PO_RECEIPT", sourceRef: { in: refs } },
    select: { sourceRef: true, reference: true, totalPence: true },
  });
  return new Map(journals.map((j) => [j.sourceRef, j]));
}
