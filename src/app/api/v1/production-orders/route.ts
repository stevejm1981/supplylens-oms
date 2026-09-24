import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const orders = await db.productionOrder.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    orderBy: { reference: "asc" },
    include: {
      product: { select: { sku: true } },
      warehouse: { select: { code: true } },
      lines: { include: { component: { select: { sku: true } } } },
    },
  });
  return NextResponse.json({
    items: orders.map((o) => ({
      reference: o.reference,
      updatedAt: o.updatedAt,
      product: o.product.sku,
      warehouse: o.warehouse.code,
      status: o.status,
      plannedQty: o.plannedQty,
      actualQty: o.actualQty,
      overheadPence: o.overheadPence,
      startedAt: o.startedAt,
      completedAt: o.completedAt,
      lines: o.lines.map((l) => ({
        component: l.component.sku,
        plannedQty: l.plannedQty,
        actualQty: l.actualQty,
        unitCostPence: l.unitCostPence,
      })),
    })),
  });
}
