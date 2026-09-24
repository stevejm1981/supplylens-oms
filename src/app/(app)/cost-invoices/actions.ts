"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { allocateInvoice, type AllocationMethod } from "@/lib/engine/landed-cost";
import { JOURNAL_ACCOUNTS, recordStockJournal } from "@/lib/journals";

export type ActionResult =
  | { ok: true; id?: string; fallback?: boolean }
  | { ok: false; error: string };

export interface NewCostInvoice {
  reference: string;
  vendor: string;
  type: string;
  amountPence: number;
  allocationMethod: AllocationMethod;
  invoiceDate: string | null;
  notes: string | null;
  poIds: string[];
}

/**
 * Creates the invoice and persists its allocation in one transaction.
 * Allocations are a deterministic cache of the pure allocator over the union
 * of all lines across the linked POs.
 */
export async function createCostInvoice(input: NewCostInvoice): Promise<ActionResult> {
  if (!input.reference.trim() || !input.vendor.trim()) {
    return { ok: false, error: "Reference and vendor are required" };
  }
  if (!Number.isInteger(input.amountPence) || input.amountPence <= 0) {
    return { ok: false, error: "Amount must be greater than zero" };
  }
  if (input.poIds.length === 0) {
    return { ok: false, error: "Link at least one purchase order" };
  }

  const lines = await db.purchaseOrderLine.findMany({
    where: { poId: { in: input.poIds } },
    include: {
      product: { select: { weightGrams: true } },
      purchaseOrder: { select: { status: true } },
    },
  });
  if (lines.length === 0) {
    return { ok: false, error: "The selected purchase orders have no lines" };
  }

  let outcome;
  try {
    outcome = allocateInvoice(
      input.amountPence,
      input.allocationMethod,
      lines.map((l) => ({
        lineId: l.id,
        quantity: l.quantity,
        unitCostPence: l.unitCostPence,
        unitWeightGrams: l.product.weightGrams,
      })),
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Allocation failed" };
  }

  try {
    const invoice = await db.$transaction(async (tx) => {
      const created = await tx.costInvoice.create({
        data: {
          reference: input.reference.trim(),
          vendor: input.vendor.trim(),
          type: input.type,
          amountPence: input.amountPence,
          allocationMethod: input.allocationMethod,
          invoiceDate: input.invoiceDate ? new Date(input.invoiceDate) : new Date(),
          notes: input.notes?.trim() || null,
          purchaseOrders: {
            create: input.poIds.map((purchaseOrderId) => ({ purchaseOrderId })),
          },
        },
      });
      await tx.costAllocation.createMany({
        data: outcome.results.map((r) => ({
          costInvoiceId: created.id,
          poLineId: r.lineId,
          amountPence: r.amountPence,
        })),
      });
      // Financials: costs allocated to goods ALREADY on the shelf uplift the
      // stock asset now (Dr Stock / Cr Landed Costs Clearing, which the
      // supplier's bill clears in the ledger app). Costs on unreceived POs
      // are picked up by the receipt journal instead.
      const receivedById = new Map(lines.map((l) => [l.id, l.purchaseOrder.status === "RECEIVED"]));
      const receivedPortion = outcome.results
        .filter((r) => receivedById.get(r.lineId))
        .reduce((s, r) => s + r.amountPence, 0);
      if (receivedPortion > 0) {
        await recordStockJournal(tx, {
          type: "LANDED_COST",
          sourceRef: created.reference,
          sourceId: created.id,
          memo: `Landed costs ${created.reference} (${created.vendor}) onto received stock`,
          lines: [
            { account: JOURNAL_ACCOUNTS.stock, debitPence: receivedPortion },
            { account: JOURNAL_ACCOUNTS.landedClearing, creditPence: receivedPortion },
          ],
        });
      }
      return created;
    });
    revalidatePath("/cost-invoices");
    revalidatePath("/purchase-orders");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true, id: invoice.id, fallback: outcome.fallback };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
}

export async function deleteCostInvoice(id: string): Promise<ActionResult> {
  try {
    const invoice = await db.costInvoice.findUnique({
      where: { id },
      include: {
        allocations: { include: { poLine: { include: { purchaseOrder: true } } } },
      },
    });
    if (!invoice) return { ok: false, error: "Cost invoice not found" };
    const receivedPortion = invoice.allocations
      .filter((a) => a.poLine.purchaseOrder.status === "RECEIVED")
      .reduce((s, a) => s + a.amountPence, 0);
    await db.$transaction(async (tx) => {
      if (receivedPortion > 0) {
        // Reverse the uplift so the books match the removed allocation.
        await recordStockJournal(tx, {
          type: "LANDED_COST",
          sourceRef: invoice.reference,
          sourceId: invoice.id,
          memo: `Landed costs ${invoice.reference} removed, uplift reversed`,
          lines: [
            { account: JOURNAL_ACCOUNTS.landedClearing, debitPence: receivedPortion },
            { account: JOURNAL_ACCOUNTS.stock, creditPence: receivedPortion },
          ],
        });
      }
      await tx.costInvoice.delete({ where: { id } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/cost-invoices");
  revalidatePath("/purchase-orders");
  revalidatePath("/products");
  revalidatePath("/stock");
  return { ok: true };
}
