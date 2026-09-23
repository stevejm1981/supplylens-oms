"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateInvoices() {
  revalidatePath("/invoices");
  revalidatePath("/sales-orders");
  revalidatePath("/reports");
}

export async function markInvoicePaid(id: string): Promise<ActionResult> {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (invoice.paidAt) return { ok: false, error: "Already marked paid" };
  await db.invoice.update({ where: { id }, data: { paidAt: new Date() } });
  revalidateInvoices();
  return { ok: true };
}

/** Undo an accidental mark-paid, mistakes happen at the bench and the desk. */
export async function markInvoiceUnpaid(id: string): Promise<ActionResult> {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) return { ok: false, error: "Invoice not found" };
  if (!invoice.paidAt) return { ok: false, error: "Not marked paid" };
  await db.invoice.update({ where: { id }, data: { paidAt: null } });
  revalidateInvoices();
  return { ok: true };
}
