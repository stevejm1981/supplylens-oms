import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const transfers = await db.warehouseTransfer.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { reference: "asc" },
    include: {
      fromWarehouse: { select: { code: true } },
      toWarehouse: { select: { code: true } },
      lines: { include: { product: { select: { sku: true } } } },
    },
  });
  return NextResponse.json({
    items: transfers.map((t) => ({
      reference: t.reference,
      updatedAt: t.updatedAt,
      createdAt: t.createdAt,
      fromWarehouse: t.fromWarehouse.code,
      toWarehouse: t.toWarehouse.code,
      notes: t.notes,
      lines: t.lines.map((l) => ({ sku: l.product.sku, quantity: l.quantity })),
    })),
  });
}
