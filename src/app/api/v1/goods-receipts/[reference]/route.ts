// Single GRN readback: the draft-bill payload plus billed state.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireApiKey } from "../../auth";
import { journalsByReceiptRef, receiptInclude, serializeReceipt } from "../serialize";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;
  const receipt = await db.goodsReceipt.findUnique({
    where: { reference: reference.toUpperCase() },
    include: receiptInclude,
  });
  if (!receipt) {
    return NextResponse.json({ ok: false, error: "Unknown goods receipt" }, { status: 404 });
  }
  const journals = await journalsByReceiptRef([receipt.reference]);
  return NextResponse.json(serializeReceipt(receipt, journals.get(receipt.reference) ?? null));
}
