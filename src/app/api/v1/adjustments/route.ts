import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const adjustments = await db.stockAdjustment.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { reference: "asc" },
    include: {
      warehouse: { select: { code: true } },
      lines: { include: { product: { select: { sku: true } } } },
    },
  });
  return NextResponse.json({
    items: adjustments.map((a) => ({
      reference: a.reference,
      updatedAt: a.updatedAt,
      createdAt: a.createdAt,
      warehouse: a.warehouse.code,
      reason: a.reason,
      notes: a.notes,
      lines: a.lines.map((l) => ({ sku: l.product.sku, quantityDelta: l.quantityDelta })),
    })),
  });
}
