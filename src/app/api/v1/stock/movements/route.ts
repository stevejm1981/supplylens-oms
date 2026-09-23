import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 200) || 200, 1000);
  const sku = url.searchParams.get("sku");
  const since = parseUpdatedSince(request);
  const movements = await db.stockMovement.findMany({
    where: {
      ...(sku ? { product: { sku: sku.toUpperCase() } } : {}),
      ...(since ? { createdAt: { gt: since } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      product: { select: { sku: true } },
      warehouse: { select: { code: true } },
    },
  });
  return NextResponse.json({
    items: movements.map((m) => ({
      at: m.createdAt,
      sku: m.product.sku,
      warehouse: m.warehouse.code,
      quantity: m.quantity,
      balanceAfter: m.balanceAfter,
      type: m.type,
      reference: m.reference,
    })),
  });
}
