import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { carriageStatus } from "@/lib/engine/carriage";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const despatches = await db.despatch.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { reference: "asc" },
    include: {
      salesOrder: { select: { reference: true } },
      lines: { include: { orderLine: { include: { product: { select: { sku: true } } } } } },
      carrierAllocations: { select: { amountPence: true } },
    },
  });
  return NextResponse.json({
    items: despatches.map((d) => ({
      reference: d.reference,
      updatedAt: d.updatedAt,
      salesOrder: d.salesOrder.reference,
      status: d.status,
      shippingService: d.shippingService,
      trackingNumber: d.trackingNumber,
      despatchedAt: d.despatchedAt,
      expectedCarriagePence: d.expectedCarriagePence,
      carriageStatus: carriageStatus(
        d.expectedCarriagePence,
        d.carrierAllocations.reduce((sum, a) => sum + a.amountPence, 0),
      ),
      lines: d.lines.map((l) => ({
        sku: l.orderLine.product.sku,
        quantity: l.quantity,
        pickedQty: l.pickedQty,
        despatchedQty: l.despatchedQty,
      })),
    })),
  });
}
