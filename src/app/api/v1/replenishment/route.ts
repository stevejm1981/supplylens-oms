import { NextResponse } from "next/server";
import { getReplenishmentRows } from "@/lib/replenishment";
import {
  ORDER_CYCLE_DAYS,
  SAFETY_STOCK_DAYS,
  VELOCITY_WINDOW_DAYS,
} from "@/lib/engine/replenishment";
import { requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const actionOnly = url.searchParams.has("actionable");
  const rows = await getReplenishmentRows();
  return NextResponse.json({
    parameters: {
      velocityWindowDays: VELOCITY_WINDOW_DAYS,
      safetyStockDays: SAFETY_STOCK_DAYS,
      orderCycleDays: ORDER_CYCLE_DAYS,
    },
    items: rows
      .filter((r) => !actionOnly || r.suggestedOrderQty > 0)
      .map((r) => ({
        sku: r.sku,
        supplier: r.supplierName,
        leadTimeDays: r.leadTimeDays,
        despatchedInWindow: r.despatchedInWindow,
        velocityPerDay: r.velocityPerDay,
        available: r.available,
        onOrder: r.onOrder,
        nextInbound: r.nextInboundRef
          ? { reference: r.nextInboundRef, expectedDate: r.nextInboundDate }
          : null,
        daysOfCover: r.daysOfCover,
        daysOfCoverInclInbound: r.daysOfCoverInbound,
        reorderPointUnits: r.reorderPointUnits,
        orderUpToUnits: r.orderUpToUnits,
        status: r.status,
        suggestedOrderQty: r.suggestedOrderQty,
        suggestedValuePence: Math.round(r.suggestedOrderQty * r.unitCostPence),
      })),
  });
}
