import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const invoices = await db.invoice.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { number: "asc" },
    include: {
      salesOrder: {
        select: { reference: true, customer: { select: { code: true } }, taxTreatment: true },
      },
    },
  });
  return NextResponse.json({
    items: invoices.map((inv) => ({
      number: inv.number,
      updatedAt: inv.updatedAt,
      salesOrder: inv.salesOrder.reference,
      customer: inv.salesOrder.customer.code,
      taxTreatment: inv.salesOrder.taxTreatment,
      invoiceDate: inv.invoiceDate,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt,
      paymentStatus: inv.paidAt
        ? "PAID"
        : inv.dueDate && inv.dueDate.getTime() < Date.now()
          ? "OVERDUE"
          : "UNPAID",
      netPence: inv.netPence,
      vatPence: inv.vatPence,
      grossPence: inv.grossPence,
    })),
  });
}
