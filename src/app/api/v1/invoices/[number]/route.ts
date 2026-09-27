import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../auth";
import { invoiceInclude, serializeInvoice } from "../serialize";

// Single invoice readback, the same full document shape as the register.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { number } = await params;
  const invoice = await db.invoice.findUnique({
    where: { number: number.toUpperCase() },
    include: invoiceInclude,
  });
  if (!invoice) {
    return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, ...serializeInvoice(invoice) });
}
