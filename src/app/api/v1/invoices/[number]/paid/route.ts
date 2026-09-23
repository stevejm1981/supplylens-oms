// Payment confirmation, typically the accounting sync telling the OMS that
// Xero received the money. Idempotent: re-confirming returns duplicate.
// Optional body: { "paidAt": "2026-09-24" }, defaults to now.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { number } = await params;

  let payload: { paidAt?: string };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const invoice = await db.invoice.findUnique({ where: { number: number.toUpperCase() } });
  if (!invoice) {
    return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.paidAt) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      number: invoice.number,
      paidAt: invoice.paidAt,
    });
  }
  let paidAt = new Date();
  if (payload.paidAt) {
    const parsed = new Date(payload.paidAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "invalid paidAt date" }, { status: 422 });
    }
    paidAt = parsed;
  }
  const updated = await db.invoice.update({ where: { id: invoice.id }, data: { paidAt } });
  return NextResponse.json({
    ok: true,
    duplicate: false,
    number: updated.number,
    paidAt: updated.paidAt,
    paymentStatus: "PAID",
  });
}
