import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const pos = await db.purchaseOrder.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { reference: "asc" },
    include: {
      supplier: { select: { code: true } },
      lines: { include: { product: { select: { sku: true } }, allocations: true } },
    },
  });
  return NextResponse.json({
    items: pos.map((po) => ({
      reference: po.reference,
      updatedAt: po.updatedAt,
      supplier: po.supplier.code,
      status: po.status,
      containerRef: po.containerRef,
      expectedDate: po.expectedDate,
      receivedAt: po.receivedAt,
      lines: po.lines.map((l) => ({
        sku: l.product.sku,
        quantity: l.quantity,
        unitCostPence: l.unitCostPence,
        allocatedCostsPence: l.allocations.reduce((s, a) => s + a.amountPence, 0),
      })),
    })),
  });
}
