"use server";

// Buyer-facing actions. Every one re-verifies the portal session and scopes
// strictly to the buyer's own customer; prices are always resolved server
// side, the basket only sends product, unit, and quantity.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth-crypto";
import {
  createPortalSession,
  destroyPortalSession,
  getCurrentBuyer,
} from "@/lib/portal-auth";
import { resolveUnitPrice } from "@/lib/engine/pricing";
import { createSalesOrder } from "@/app/(app)/sales-orders/actions";
import { createCustomerReturn } from "@/app/(app)/returns/actions";

export type PortalResult = { ok: false; error: string }; // success redirects

export async function portalSignIn(input: {
  email: string;
  password: string;
}): Promise<PortalResult> {
  const email = input.email.trim().toLowerCase();
  const user = await db.portalUser.findUnique({ where: { email } });
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    return { ok: false, error: "Email or password is incorrect" };
  }
  await createPortalSession(user.id);
  redirect("/portal");
}

export async function portalSignOut(): Promise<void> {
  await destroyPortalSession();
  redirect("/portal/sign-in");
}

export async function acceptPortalInvite(
  token: string,
  input: { name: string; password: string },
): Promise<PortalResult> {
  const invitation = await db.portalInvitation.findUnique({ where: { token } });
  if (!invitation || invitation.acceptedAt) {
    return { ok: false, error: "This invitation is no longer valid" };
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This invitation has expired, ask for a new one" };
  }
  if (!input.name.trim()) return { ok: false, error: "Your name is required" };
  if (input.password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters" };
  }
  const existing = await db.portalUser.findUnique({ where: { email: invitation.email } });
  if (existing) return { ok: false, error: "That email already has access, sign in instead" };
  const user = await db.$transaction(async (tx) => {
    const created = await tx.portalUser.create({
      data: {
        customerId: invitation.customerId,
        email: invitation.email,
        name: input.name.trim(),
        passwordHash: hashPassword(input.password),
      },
    });
    await tx.portalInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    return created;
  });
  await createPortalSession(user.id);
  redirect("/portal");
}

export interface BasketLine {
  productId: string;
  uomCode: string | null;
  quantity: number;
}

export async function portalPlaceOrder(input: {
  lines: BasketLine[];
  deliveryLocationId: string | null;
  customerPoNumber: string | null;
  notes: string | null;
}): Promise<{ ok: true; orderId: string; reference: string; proforma: boolean } | { ok: false; error: string }> {
  const buyer = await getCurrentBuyer();
  if (!buyer) return { ok: false, error: "Not signed in" };
  const customer = await db.customer.findUniqueOrThrow({
    where: { id: buyer.customerId },
    include: { locations: true, prices: true },
  });
  if (!customer.defaultSalesPersonId) {
    return { ok: false, error: "Your account is not fully set up yet, please contact us" };
  }
  const lines = input.lines.filter((l) => l.productId && l.quantity > 0);
  if (lines.length === 0) return { ok: false, error: "Your basket is empty" };

  const products = await db.product.findMany({
    where: { id: { in: lines.map((l) => l.productId) } },
    include: { uoms: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const orderLines = [];
  for (const l of lines) {
    const product = byId.get(l.productId);
    if (!product) return { ok: false, error: "A basket item no longer exists" };
    if (!Number.isInteger(l.quantity) || l.quantity < 1) {
      return { ok: false, error: `Invalid quantity for ${product.sku}` };
    }
    const uom = l.uomCode ? product.uoms.find((u) => u.code === l.uomCode) : null;
    if (l.uomCode && !uom) return { ok: false, error: `Unknown pack for ${product.sku}` };
    const listed = customer.prices.find((p) => p.productId === product.id);
    orderLines.push({
      productId: product.id,
      quantity: l.quantity,
      uomCode: uom?.code ?? null,
      unitsPerUom: uom?.unitsPerUom ?? 1,
      unitPricePence: resolveUnitPrice({
        customerPricePence: listed?.unitPricePence ?? null,
        sellPricePence: product.sellPricePence,
        unitsPerUom: uom?.unitsPerUom ?? 1,
      }),
      discountPct: 0,
    });
  }

  const location = input.deliveryLocationId
    ? customer.locations.find((loc) => loc.id === input.deliveryLocationId)
    : (customer.locations.find((loc) => loc.isDefault) ?? customer.locations[0] ?? null);

  const channel = await db.channel.upsert({
    where: { code: "b2b-portal" },
    create: { name: "B2B Portal", code: "b2b-portal", rulesJson: "[]" },
    update: {},
  });

  const proforma = customer.paymentTermsDays === 0;
  const warehouseId =
    customer.defaultWarehouseId ??
    (await db.warehouse.findFirstOrThrow({ where: { isDefault: true } })).id;

  const result = await createSalesOrder({
    customerId: customer.id,
    salesPersonId: customer.defaultSalesPersonId,
    warehouseId,
    channelId: channel.id,
    deliveryLocationId: location?.id ?? null,
    orderDate: null,
    requiredDate: null,
    customerPoNumber: input.customerPoNumber?.trim() || null,
    externalRef: null,
    deliveryAddress: location?.address ?? customer.deliveryAddress ?? null,
    deliveryContact: location?.contact ?? null,
    shippingService: null,
    shippingInstructions: null,
    giftMessage: null,
    shippingPence: 0,
    taxTreatment: "EXCLUSIVE",
    isPreOrder: false,
    notes: [
      `Placed via portal by ${buyer.name}`,
      proforma ? "PROFORMA, awaiting payment before despatch" : null,
      input.notes?.trim() || null,
    ]
      .filter(Boolean)
      .join(". "),
    lines: orderLines,
  });
  if (!result.ok) return { ok: false, error: result.error };

  const order = await db.salesOrder.findUniqueOrThrow({ where: { id: result.id! } });
  revalidatePath("/portal");
  return { ok: true, orderId: order.id, reference: order.reference, proforma };
}

export async function portalRequestReturn(input: {
  orderId: string;
  reason: string;
  lines: { orderLineId: string; quantity: number }[];
}): Promise<{ ok: boolean; error?: string }> {
  const buyer = await getCurrentBuyer();
  if (!buyer) return { ok: false, error: "Not signed in" };
  const order = await db.salesOrder.findUnique({ where: { id: input.orderId } });
  if (!order || order.customerId !== buyer.customerId) {
    return { ok: false, error: "Order not found" };
  }
  if (!input.reason.trim()) return { ok: false, error: "Tell us why you are returning it" };
  const result = await createCustomerReturn({
    salesOrderId: order.id,
    warehouseId: order.warehouseId,
    reason: `Portal request by ${buyer.name}: ${input.reason.trim()}`,
    lines: input.lines,
  });
  if (result.ok) revalidatePath("/portal");
  return result;
}
