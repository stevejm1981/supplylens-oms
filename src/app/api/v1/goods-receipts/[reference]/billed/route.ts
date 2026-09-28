// The three-way-match ack: the ledger app confirms the supplier's invoice
// for this delivery was approved and posted (Dr GRNI / Cr Creditors on its
// side). Idempotent; stores the ledger app's bill id for the audit trail.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireApiKey } from "../../../auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;
  let externalRef: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.externalRef === "string") externalRef = body.externalRef.trim() || null;
  } catch {
    // empty body is fine
  }

  const receipt = await db.goodsReceipt.findUnique({
    where: { reference: reference.toUpperCase() },
  });
  if (!receipt) {
    return NextResponse.json({ ok: false, error: "Unknown goods receipt" }, { status: 404 });
  }
  if (receipt.billedAt) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      reference: receipt.reference,
      billedAt: receipt.billedAt,
      externalRef: receipt.billExternalRef,
    });
  }
  const updated = await db.goodsReceipt.update({
    where: { id: receipt.id },
    data: { billedAt: new Date(), billExternalRef: externalRef },
  });
  return NextResponse.json({
    ok: true,
    duplicate: false,
    reference: updated.reference,
    billedAt: updated.billedAt,
    externalRef: updated.billExternalRef,
  });
}
