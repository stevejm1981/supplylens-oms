"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { allocateInvoice, type AllocationMethod } from "@/lib/engine/landed-cost";

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
    include: { product: { select: { weightGrams: true } } },
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
    await db.costInvoice.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/cost-invoices");
  revalidatePath("/purchase-orders");
  revalidatePath("/products");
  revalidatePath("/stock");
  return { ok: true };
}
