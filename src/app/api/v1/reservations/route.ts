import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const reservations = await db.stockReservation.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { reference: "asc" },
    include: {
      product: { select: { sku: true } },
      warehouse: { select: { code: true } },
      customer: { select: { code: true } },
      purchaseOrder: { select: { reference: true } },
    },
  });
  return NextResponse.json({
    items: reservations.map((r) => ({
      reference: r.reference,
      updatedAt: r.updatedAt,
      sku: r.product.sku,
      warehouse: r.warehouse.code,
      quantity: r.quantity,
      heldForCustomer: r.customer?.code ?? null,
      awaitingPurchaseOrder: r.purchaseOrder?.reference ?? null,
      status: r.status,
      reason: r.reason,
      expiresAt: r.expiresAt,
    })),
  });
}
