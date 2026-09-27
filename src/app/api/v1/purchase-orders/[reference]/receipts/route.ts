// Goods-in confirmation, the warehouse booking a delivery against a placed
// PO. Runs the same transaction as the Goods-In Station: stock lands, the
// ledger records PO_RECEIPT lines (with batches for tracked products),
// pending inbound reservation holds activate with zero gap, this delivery's
// PO_RECEIPT stock journal is written, and the PO walks
// PLACED → PARTIALLY_RECEIVED → RECEIVED.
//
// Two shapes:
//   {}, or { warehouse }                       → receive ALL outstanding
//   { warehouse?, lines: [{ sku | barcode,     → receive THIS delivery only
//       quantity, batchRef?, bestBefore? }] }     (quantities in base units)
//
// Idempotent: receiving an already-received PO returns duplicate, not an error.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { receiptProgress } from "@/lib/engine/fefo";
import {
  receiveGoodsReceipt,
  receivePurchaseOrder,
  type GoodsReceiptLineInput,
} from "@/app/(app)/purchase-orders/actions";
import { requireApiKey } from "../../../auth";

interface ReceiptLinePayload {
  sku?: string;
  barcode?: string;
  quantity?: number;
  batchRef?: string;
  bestBefore?: string; // "yyyy-mm-dd"
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;

  let payload: { warehouse?: string; notes?: string; lines?: ReceiptLinePayload[] };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const po = await db.purchaseOrder.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      lines: { include: { product: { select: { sku: true, barcode: true } } } },
      receipts: { include: { lines: true } },
    },
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

  // No lines → the whole-delivery path, everything outstanding in one go.
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    const result = await receivePurchaseOrder(po.id, warehouse.id);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
    }
    return NextResponse.json(
      {
        ok: true,
        duplicate: false,
        reference: po.reference,
        goodsReceipt: result.reference,
        status: result.status,
        warehouse: warehouse.code,
      },
      { status: 201 },
    );
  }

  // Partial delivery: resolve each payload line to PO lines by sku or
  // barcode, spilling across duplicate lines of the same product in order.
  const progress = receiptProgress(
    po.lines.map((l) => ({ id: l.id, quantity: l.quantity })),
    po.receipts.flatMap((r) => r.lines.map((x) => ({ poLineId: x.poLineId, quantity: x.quantity }))),
  );
  const outstanding = new Map(progress.outstandingByLine);
  const resolved: GoodsReceiptLineInput[] = [];
  for (const [i, line] of payload.lines.entries()) {
    const qty = line.quantity;
    if (!Number.isInteger(qty) || !qty || qty <= 0) {
      return NextResponse.json(
        { ok: false, error: `lines[${i}]: quantity must be a positive whole number of base units` },
        { status: 422 },
      );
    }
    const matches = po.lines.filter((l) =>
      line.barcode
        ? l.product.barcode === line.barcode
        : line.sku
          ? l.product.sku === line.sku.toUpperCase()
          : false,
    );
    if (matches.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: `lines[${i}]: ${line.sku ?? line.barcode ?? "line"} is not on ${po.reference}`,
        },
        { status: 422 },
      );
    }
    let remaining = qty;
    for (const poLine of matches) {
      if (remaining <= 0) break;
      const room = outstanding.get(poLine.id) ?? 0;
      const take = matches.indexOf(poLine) === matches.length - 1 ? remaining : Math.min(room, remaining);
      if (take <= 0) continue;
      outstanding.set(poLine.id, Math.max(0, room - take));
      resolved.push({
        poLineId: poLine.id,
        quantity: take,
        batchRef: line.batchRef ?? null,
        bestBefore: line.bestBefore ?? null,
      });
      remaining -= take;
    }
  }

  const result = await receiveGoodsReceipt({
    poId: po.id,
    warehouseId: warehouse.id,
    notes: payload.notes ?? null,
    lines: resolved,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      reference: po.reference,
      goodsReceipt: result.reference,
      status: result.status,
      warehouse: warehouse.code,
    },
    { status: 201 },
  );
}
