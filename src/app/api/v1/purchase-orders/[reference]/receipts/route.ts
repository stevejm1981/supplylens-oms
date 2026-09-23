// Goods-in confirmation, the warehouse booking a placed PO into stock.
// Runs the same transaction as the UI's Receive button: stock lands, the
// ledger records PO_RECEIPT lines, pending inbound reservation holds activate
// with zero gap, the PO_RECEIPT stock journal is written, and the PO locks.
// Idempotent: receiving an already-received PO returns duplicate, not an error.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { receivePurchaseOrder } from "@/app/(app)/purchase-orders/actions";
import { requireApiKey } from "../../../auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;

  let payload: { warehouse?: string };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const po = await db.purchaseOrder.findUnique({
    where: { reference: reference.toUpperCase() },
  });
  if (!po) {
    return NextResponse.json({ ok: false, error: "Purchase order not found" }, { status: 404 });
  }
  if (po.status === "RECEIVED") {
    return NextResponse.json({ ok: true, duplicate: true, reference: po.reference, status: "RECEIVED" });
  }
  if (po.status === "DRAFT") {
    return NextResponse.json(
      { ok: false, error: `${po.reference} is still a draft, place it before receiving` },
      { status: 422 },
    );
  }

  const warehouse = payload.warehouse
    ? await db.warehouse.findUnique({ where: { code: payload.warehouse.toUpperCase() } })
    : await db.warehouse.findFirst({ where: { isDefault: true } });
  if (!warehouse) {
    return NextResponse.json(
      {
        ok: false,
        error: payload.warehouse
          ? `unknown warehouse code "${payload.warehouse}"`
          : "no default warehouse configured, pass a warehouse code",
      },
      { status: 422 },
    );
  }

  const result = await receivePurchaseOrder(po.id, warehouse.id);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      reference: po.reference,
      status: "RECEIVED",
      warehouse: warehouse.code,
    },
    { status: 201 },
  );
}
