import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";
import { invoiceInclude, serializeInvoice } from "./serialize";

// The invoice register with FULL line detail: everything an accounting sync
// (Xero) or an EDI INVOIC needs in one read. ?updatedSince= for delta sync
// (marking an invoice paid bumps updatedAt, so payment-state changes flow);
// ?status=UNPAID|OVERDUE|PAID filters on the derived payment state.
export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const status = new URL(request.url).searchParams.get("status")?.toUpperCase() ?? null;
  if (status && !["UNPAID", "OVERDUE", "PAID"].includes(status)) {
    return NextResponse.json(
      { ok: false, error: "status must be UNPAID, OVERDUE, or PAID" },
      { status: 422 },
    );
  }
  const invoices = await db.invoice.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { number: "asc" },
    include: invoiceInclude,
  });
  const items = invoices
    .map(serializeInvoice)
    .filter((i) => !status || i.paymentStatus === status);
  return NextResponse.json({ items });
}
