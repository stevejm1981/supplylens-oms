// Despatch confirmation, the WMS/3PL (via SupplyLens) telling the OMS goods
// have physically shipped. One call does everything the UI flow does: creates
// the despatch document, deducts stock (bundle-exploded, pack-converted),
// consumes customer reservations, snapshots COGS, writes the ledger AND the
// COGS stock journal, and flips the order's fulfilment state.
//
// Idempotent per (order, externalRef): DESADV re-sends return the existing
// despatch instead of shipping twice.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  createDespatch,
  despatchDespatch,
  markDespatchPicked,
} from "@/app/(app)/sales-orders/actions";
import { requireApiKey } from "../../../auth";
import { serializeOrder } from "../../serialize";

interface ConfirmationLine {
  sku?: string; // or barcode, outer/case GTINs resolve the pack unit too
  barcode?: string;
  uom?: string;
  quantity: number; // in the ORDERED unit of the matching line
}

interface ConfirmationPayload {
  externalRef?: string; // the WMS's own shipment id, idempotency key
  shippingService?: string;
  trackingNumber?: string;
  lines: ConfirmationLine[];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;

  let payload: ConfirmationPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "at least one line with a quantity is required" },
      { status: 422 },
    );
  }

  const order = await db.salesOrder.findUnique({
    where: { reference: reference.toUpperCase() },
    include: { lines: { include: { product: true } } },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  // ── Idempotency: the WMS re-sending its shipment id is a no-op ────────────
  const externalRef = payload.externalRef?.trim() || null;
  if (externalRef) {
    const existing = await db.despatch.findFirst({
      where: { salesOrderId: order.id, externalRef },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        despatch: existing.reference,
        order: await serializeOrder(order.reference),
      });
    }
  }

  // ── Resolve confirmation lines to order lines (same rules as PATCH) ───────
  const problems: string[] = [];
  const resolved: { orderLineId: string; quantity: number }[] = [];
  for (const line of payload.lines) {
    let sku = line.sku?.toUpperCase();
    let uomCode = line.uom?.toUpperCase();
    if (!sku && line.barcode) {
      const code = line.barcode.trim();
      const byBarcode = await db.product.findUnique({ where: { barcode: code } });
      if (byBarcode) sku = byBarcode.sku;
      else {
        const outer = await db.productUom.findUnique({
          where: { barcode: code },
          include: { product: { select: { sku: true } } },
        });
        if (!outer) {
          problems.push(`unknown barcode "${line.barcode}"`);
          continue;
        }
        sku = outer.product.sku;
        uomCode = uomCode ?? outer.code;
      }
    }
    if (!sku) {
      problems.push("each line needs a sku or a barcode");
      continue;
    }
    const candidates = order.lines.filter((l) => l.product.sku === sku);
    const match =
      uomCode !== undefined
        ? candidates.find((l) => l.uomCode === uomCode)
        : (candidates.find((l) => !l.uomCode) ?? candidates[0]);
    if (!match) {
      problems.push(`"${sku}"${uomCode ? ` (${uomCode})` : ""} is not on ${order.reference}`);
      continue;
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      problems.push(`invalid quantity for "${sku}"`);
      continue;
    }
    resolved.push({ orderLineId: match.id, quantity: line.quantity });
  }
  if (problems.length > 0) {
    return NextResponse.json({ ok: false, errors: problems }, { status: 422 });
  }

  // ── Run the full despatch lifecycle in one confirmed step ─────────────────
  const created = await createDespatch(order.id, resolved);
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 422 });
  }
  const despatch = await db.despatch.findFirstOrThrow({
    where: { salesOrderId: order.id },
    orderBy: { reference: "desc" },
    include: { lines: true },
  });
  if (externalRef) {
    await db.despatch.update({ where: { id: despatch.id }, data: { externalRef } });
  }
  const rollback = async () => db.despatch.delete({ where: { id: despatch.id } });

  const picked = await markDespatchPicked(
    despatch.id,
    despatch.lines.map((l) => ({ despatchLineId: l.id, pickedQty: l.quantity })),
  );
  if (!picked.ok) {
    await rollback();
    return NextResponse.json({ ok: false, error: picked.error }, { status: 422 });
  }
  const shipped = await despatchDespatch(despatch.id, {
    shippingService: payload.shippingService ?? null,
    trackingNumber: payload.trackingNumber ?? null,
  });
  if (!shipped.ok) {
    // e.g. stock shortage, undo the confirmation attempt entirely.
    await rollback();
    return NextResponse.json({ ok: false, error: shipped.error }, { status: 422 });
  }

  return NextResponse.json(
    {
      ok: true,
      duplicate: false,
      despatch: despatch.reference,
      order: await serializeOrder(order.reference),
    },
    { status: 201 },
  );
}
