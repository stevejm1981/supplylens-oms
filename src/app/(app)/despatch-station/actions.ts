"use server";

// Thin wrappers for the Despatch Station. NO new business logic lives here,
// every transition delegates to the same sales-order despatch actions the rest
// of the app uses, so the station can never behave differently from the
// Sales Orders screen. It is a skin over the existing document flow.

import { db } from "@/lib/db";
import {
  createDespatch,
  deleteDespatch,
  despatchDespatch,
  markDespatchPicked,
} from "@/app/(app)/sales-orders/actions";

export interface StationDespatchLine {
  despatchLineId: string;
  orderLineId: string;
  quantity: number;
  pickedQty: number;
}

export type StationStart =
  | { ok: true; despatchId: string; reference: string; status: string; lines: StationDespatchLine[] }
  | { ok: false; error: string };

/**
 * Start (or resume) picking an order. If an unfinished despatch already
 * exists it is resumed; otherwise one is created for everything outstanding.
 */
export async function startPicking(orderId: string): Promise<StationStart> {
  const existing = await db.despatch.findFirst({
    where: { salesOrderId: orderId, status: { in: ["PICKING", "PICKED"] } },
    include: { lines: true },
  });
  if (existing) {
    return {
      ok: true,
      despatchId: existing.id,
      reference: existing.reference,
      status: existing.status,
      lines: existing.lines.map((l) => ({
        despatchLineId: l.id,
        orderLineId: l.orderLineId,
        quantity: l.quantity,
        pickedQty: l.pickedQty,
      })),
    };
  }

  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: true, despatches: { include: { lines: true } } },
  });
  if (!order) return { ok: false, error: "Order not found" };
  const planned = new Map<string, number>();
  for (const d of order.despatches) {
    for (const l of d.lines) {
      planned.set(l.orderLineId, (planned.get(l.orderLineId) ?? 0) + l.quantity);
    }
  }
  const outstanding = order.lines
    .map((l) => ({ orderLineId: l.id, quantity: l.quantity - (planned.get(l.id) ?? 0) }))
    .filter((l) => l.quantity > 0);
  if (outstanding.length === 0) {
    return { ok: false, error: "Nothing outstanding on this order" };
  }

  const created = await createDespatch(orderId, outstanding);
  if (!created.ok) return { ok: false, error: created.error };
  const despatch = await db.despatch.findFirstOrThrow({
    where: { salesOrderId: orderId },
    orderBy: { reference: "desc" },
    include: { lines: true },
  });
  return {
    ok: true,
    despatchId: despatch.id,
    reference: despatch.reference,
    status: despatch.status,
    lines: despatch.lines.map((l) => ({
      despatchLineId: l.id,
      orderLineId: l.orderLineId,
      quantity: l.quantity,
      pickedQty: l.pickedQty,
    })),
  };
}

export async function finishPicking(
  despatchId: string,
  picks: { despatchLineId: string; pickedQty: number }[],
) {
  return markDespatchPicked(despatchId, picks);
}

export async function confirmStationDespatch(
  despatchId: string,
  shipping: { shippingService?: string | null; trackingNumber?: string | null },
) {
  return despatchDespatch(despatchId, shipping);
}

export async function cancelPicking(despatchId: string) {
  return deleteDespatch(despatchId);
}
