"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { nextRef } from "@/lib/settings";
import { getAvailability } from "@/lib/queries";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate() {
  revalidatePath("/reservations");
  revalidatePath("/stock");
  revalidatePath("/channels");
  revalidatePath("/bundles");
  revalidatePath("/products");
}

export async function createReservation(input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  customerId: string | null;
  awaitingPoId: string | null; // hold against inbound stock on this open PO
  reason: string | null;
  expiresAt: string | null;
}): Promise<ActionResult> {
  if (!input.productId || !input.warehouseId) {
    return { ok: false, error: "Product and warehouse are required" };
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: "Quantity must be a positive whole number" };
  }

  let status = "ACTIVE";
  if (input.awaitingPoId) {
    // Inbound hold: capped at what's actually on the water for this product,
    // minus holds already pending against the same PO. Activates on receipt.
    const po = await db.purchaseOrder.findUnique({
      where: { id: input.awaitingPoId },
      include: { lines: true, reservations: { where: { status: "PENDING" } } },
    });
    if (!po) return { ok: false, error: "Purchase order not found" };
    if (po.status === "RECEIVED") {
      return { ok: false, error: "That PO has already been received, reserve from stock instead" };
    }
    const inbound = po.lines
      .filter((l) => l.productId === input.productId)
      .reduce((s, l) => s + l.quantity, 0);
    if (inbound === 0) {
      return { ok: false, error: "That product isn't on the selected PO" };
    }
    const alreadyHeld = po.reservations
      .filter((r) => r.productId === input.productId)
      .reduce((s, r) => s + r.quantity, 0);
    const reservable = inbound - alreadyHeld;
    if (input.quantity > reservable) {
      return {
        ok: false,
        error: `Only ${Math.max(0, reservable)} reservable on ${po.reference} (${inbound} inbound, ${alreadyHeld} already held)`,
      };
    }
    status = "PENDING";
  } else {
    // Reservations from stock secure what is genuinely free, you can't
    // ring-fence stock already promised to orders or other reservations.
    const { byProductWarehouse } = await getAvailability();
    const a = byProductWarehouse.get(`${input.productId}|${input.warehouseId}`);
    const available = a?.available ?? 0;
    if (input.quantity > available) {
      return {
        ok: false,
        error: `Only ${Math.max(0, available)} available to reserve here (${a?.onHand ?? 0} on hand, ${a?.committed ?? 0} committed, ${a?.reserved ?? 0} already reserved). To secure stock still inbound, link the reservation to its PO.`,
      };
    }
  }

  try {
    const count = await db.stockReservation.count();
    await db.stockReservation.create({
      data: {
        reference: await nextRef("reservation", count),
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        customerId: input.customerId,
        purchaseOrderId: input.awaitingPoId,
        status,
        reason: input.reason?.trim() || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
  revalidate();
  return { ok: true };
}

export async function releaseReservation(id: string): Promise<ActionResult> {
  const reservation = await db.stockReservation.findUnique({ where: { id } });
  if (!reservation) return { ok: false, error: "Reservation not found" };
  if (reservation.status === "RELEASED") {
    return { ok: false, error: "Already released" };
  }
  await db.stockReservation.update({
    where: { id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  revalidate();
  return { ok: true };
}
