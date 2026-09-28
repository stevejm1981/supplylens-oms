// Goods receipts (GRNs) for the ledger integration: each item carries
// everything needed to raise the DRAFT supplier bill coded to GRNI, and
// its billed state for the three-way match. ?status=UNBILLED is the
// running list of deliveries still awaiting an approved supplier invoice.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";
import { journalsByReceiptRef, receiptInclude, serializeReceipt } from "./serialize";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const supplier = url.searchParams.get("supplier")?.toUpperCase();
  const since = parseUpdatedSince(request);

  const receipts = await db.goodsReceipt.findMany({
    where: {
      ...(status === "UNBILLED" ? { billedAt: null } : {}),
      ...(status === "BILLED" ? { billedAt: { not: null } } : {}),
      ...(supplier ? { purchaseOrder: { supplier: { code: supplier } } } : {}),
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    orderBy: { reference: "asc" },
    include: receiptInclude,
  });
  const journals = await journalsByReceiptRef(receipts.map((r) => r.reference));
  return NextResponse.json({
    items: receipts.map((r) => serializeReceipt(r, journals.get(r.reference) ?? null)),
  });
}
