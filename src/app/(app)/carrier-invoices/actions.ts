"use server";

// Carrier invoices: the outbound mirror of cost invoices. Matching actual
// carrier charges to despatches books only the VARIANCE against each
// despatch's carriage accrual (the bill itself is coded to Carriage Accruals
// in the ledger app, exactly as supplier bills clear GRNI). One transaction:
// document + allocations + the variance journal.

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { JOURNAL_ACCOUNTS, recordStockJournal, type JournalLineInput } from "@/lib/journals";
import { allocateConsignment, matchJournal } from "@/lib/engine/carriage";
import { lineNetPence } from "@/lib/sales";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export interface NewCarrierInvoiceLine {
  description: string | null;
  consignmentRef: string | null;
  amountPence: number;
  /** Explicit per-despatch amounts (must sum to amountPence)… */
  allocations?: { despatchId: string; amountPence: number }[];
  /** …or a split for the engine to compute. */
  split?: { despatchIds: string[]; method: "VALUE" | "WEIGHT" | "QUANTITY" };
}

export async function createCarrierInvoice(input: {
  reference: string;
  carrier: string;
  invoiceDate: string | null;
  notes: string | null;
  source?: "UI" | "API"; // provenance, defaults UI
  lines: NewCarrierInvoiceLine[];
}): Promise<ActionResult> {
  if (!input.reference.trim() || !input.carrier.trim()) {
    return { ok: false, error: "Invoice reference and carrier are required" };
  }
  const lines = input.lines.filter((l) => l.amountPence !== 0);
  if (lines.length === 0) return { ok: false, error: "Add at least one charge line" };

  // Resolve and validate every despatch up front.
  const wantedIds = new Set<string>();
  for (const l of lines) {
    if (!Number.isInteger(l.amountPence) || l.amountPence <= 0) {
      return { ok: false, error: "Line amounts must be positive whole pence" };
    }
    const ids = l.allocations?.map((a) => a.despatchId) ?? l.split?.despatchIds ?? [];
    if (ids.length === 0) {
      return { ok: false, error: "Every charge line must cover at least one despatch" };
    }
    ids.forEach((id) => wantedIds.add(id));
  }
  const despatches = await db.despatch.findMany({
    where: { id: { in: [...wantedIds] } },
    include: {
      salesOrder: { select: { id: true, reference: true } },
      carrierAllocations: { select: { amountPence: true } },
      lines: {
        include: {
          orderLine: {
            select: {
              unitPricePence: true,
              discountPct: true,
              unitsPerUom: true,
              product: { select: { weightGrams: true } },
            },
          },
        },
      },
    },
  });
  const byId = new Map(despatches.map((d) => [d.id, d]));
  for (const id of wantedIds) {
    const d = byId.get(id);
    if (!d) return { ok: false, error: "Despatch not found" };
    if (d.status !== "DESPATCHED") {
      return { ok: false, error: `${d.reference} has not been despatched yet` };
    }
  }
  const basisOf = (id: string) => {
    const d = byId.get(id)!;
    return {
      despatchId: id,
      netValuePence: d.lines.reduce(
        (s, l) =>
          s +
          lineNetPence({
            quantity: l.despatchedQty,
            unitPricePence: l.orderLine.unitPricePence,
            discountPct: l.orderLine.discountPct,
          }),
        0,
      ),
      weightGrams: d.lines.reduce(
        (s, l) =>
          s + l.despatchedQty * l.orderLine.unitsPerUom * l.orderLine.product.weightGrams,
        0,
      ),
    };
  };

  // Final allocation per line (explicit amounts verified, splits computed).
  const resolvedLines: {
    description: string | null;
    consignmentRef: string | null;
    amountPence: number;
    allocations: { despatchId: string; amountPence: number }[];
  }[] = [];
  for (const l of lines) {
    let allocations: { despatchId: string; amountPence: number }[];
    if (l.allocations && l.allocations.length > 0) {
      allocations = l.allocations.filter((a) => a.amountPence > 0);
      if (allocations.some((a) => !Number.isInteger(a.amountPence))) {
        return { ok: false, error: "Allocation amounts must be whole pence" };
      }
      const sum = allocations.reduce((s, a) => s + a.amountPence, 0);
      if (sum !== l.amountPence) {
        return {
          ok: false,
          error: `Allocations for "${l.consignmentRef ?? l.description ?? "a line"}" total ${sum}p, the line is ${l.amountPence}p`,
        };
      }
      const seen = new Set<string>();
      for (const a of allocations) {
        if (seen.has(a.despatchId)) {
          return { ok: false, error: "A despatch appears twice on one charge line" };
        }
        seen.add(a.despatchId);
      }
    } else {
      const { results } = allocateConsignment(
        l.amountPence,
        l.split!.method,
        l.split!.despatchIds.map(basisOf),
      );
      allocations = results
        .filter((r) => r.amountPence > 0)
        .map((r) => ({ despatchId: r.lineId, amountPence: r.amountPence }));
    }
    resolvedLines.push({
      description: l.description?.trim() || null,
      consignmentRef: l.consignmentRef?.trim() || null,
      amountPence: l.amountPence,
      allocations,
    });
  }

  // Variance journal, per despatch: the accrual clears once (its remainder
  // after any earlier carrier invoices), everything beyond it is cost.
  const totalsByDespatch = new Map<string, number>();
  for (const l of resolvedLines) {
    for (const a of l.allocations) {
      totalsByDespatch.set(a.despatchId, (totalsByDespatch.get(a.despatchId) ?? 0) + a.amountPence);
    }
  }
  const journalLines: JournalLineInput[] = [];
  for (const [despatchId, actual] of totalsByDespatch) {
    const d = byId.get(despatchId)!;
    const priorActual = d.carrierAllocations.reduce((s, a) => s + a.amountPence, 0);
    const remainingAccrual = Math.max(0, (d.expectedCarriagePence ?? 0) - priorActual);
    const delta = matchJournal(remainingAccrual, actual);
    if (!delta) continue;
    const note = `${d.reference} (${d.salesOrder.reference})`;
    if (delta.direction === "cost") {
      journalLines.push(
        { account: JOURNAL_ACCOUNTS.costToServe, debitPence: delta.amountPence, description: note },
        { account: JOURNAL_ACCOUNTS.carriageAccrual, creditPence: delta.amountPence, description: note },
      );
    } else {
      journalLines.push(
        { account: JOURNAL_ACCOUNTS.carriageAccrual, debitPence: delta.amountPence, description: note },
        { account: JOURNAL_ACCOUNTS.costToServe, creditPence: delta.amountPence, description: note },
      );
    }
  }

  let createdId = "";
  try {
    const created = await db.$transaction(async (tx) => {
      const invoice = await tx.carrierInvoice.create({
        data: {
          reference: input.reference.trim(),
          carrier: input.carrier.trim(),
          invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
          notes: input.notes?.trim() || null,
          source: input.source ?? "UI",
        },
      });
      for (const l of resolvedLines) {
        await tx.carrierInvoiceLine.create({
          data: {
            invoiceId: invoice.id,
            description: l.description,
            consignmentRef: l.consignmentRef,
            amountPence: l.amountPence,
            allocations: { create: l.allocations },
          },
        });
      }
      if (journalLines.length > 0) {
        await recordStockJournal(tx, {
          type: "CARRIAGE_COST",
          sourceRef: invoice.reference,
          sourceId: invoice.id,
          memo: `Carrier invoice ${invoice.reference} (${invoice.carrier}) matched to despatches`,
          lines: journalLines,
        });
      }
      return invoice;
    });
    createdId = created.id;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    return {
      ok: false,
      error: msg.includes("Unique constraint") ? "That invoice reference already exists" : msg,
    };
  }
  revalidateCarrier([...totalsByDespatch.keys()].map((id) => byId.get(id)!.salesOrder.id));
  return { ok: true, id: createdId };
}

export async function deleteCarrierInvoice(id: string): Promise<ActionResult> {
  const invoice = await db.carrierInvoice.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          allocations: {
            include: { despatch: { select: { salesOrderId: true } } },
          },
        },
      },
    },
  });
  if (!invoice) return { ok: false, error: "Carrier invoice not found" };
  // Reverse exactly what this invoice journalled (flip every line), then
  // remove the document; the accruals stand again as if it never matched.
  const journals = await db.stockJournal.findMany({
    where: { sourceRef: invoice.reference, type: "CARRIAGE_COST", sourceId: invoice.id },
    include: { lines: true },
  });
  try {
    await db.$transaction(async (tx) => {
      const reversal: JournalLineInput[] = journals.flatMap((j) =>
        j.lines.map((l) => ({
          account: l.account,
          debitPence: l.creditPence,
          creditPence: l.debitPence,
          description: l.description ?? undefined,
        })),
      );
      if (reversal.length > 0) {
        await recordStockJournal(tx, {
          type: "CARRIAGE_COST",
          sourceRef: invoice.reference,
          sourceId: invoice.id,
          memo: `Carrier invoice ${invoice.reference} removed, matching reversed`,
          lines: reversal,
        });
      }
      await tx.carrierInvoice.delete({ where: { id } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidateCarrier(
    invoice.lines.flatMap((l) => l.allocations.map((a) => a.despatch.salesOrderId)),
  );
  return { ok: true };
}

function revalidateCarrier(orderIds: string[]) {
  revalidatePath("/carrier-invoices");
  revalidatePath("/despatches");
  revalidatePath("/reports");
  for (const id of new Set(orderIds)) revalidatePath(`/sales-orders/${id}`);
}
