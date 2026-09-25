"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

const noneToNull = (v: FormDataEntryValue | null) => {
  const s = (v as string) || "";
  return s && s !== "none" ? s : null;
};

export async function saveCustomer(formData: FormData): Promise<ActionResult> {
  const id = (formData.get("id") as string) || null;
  const data = {
    name: ((formData.get("name") as string) ?? "").trim(),
    code: ((formData.get("code") as string) ?? "").trim().toUpperCase(),
    email: ((formData.get("email") as string) ?? "").trim() || null,
    phone: ((formData.get("phone") as string) ?? "").trim() || null,
    deliveryAddress: ((formData.get("deliveryAddress") as string) ?? "").trim() || null,
    paymentTermsDays: Number(formData.get("paymentTermsDays") ?? 30) || 30,
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
    defaultSalesPersonId: noneToNull(formData.get("defaultSalesPersonId")),
    defaultWarehouseId: noneToNull(formData.get("defaultWarehouseId")),
  };
  if (!data.name || !data.code) {
    return { ok: false, error: "Name and code are required" };
  }
  try {
    if (id) {
      await db.customer.update({ where: { id }, data });
    } else {
      await db.customer.create({ data });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/customers");
  return { ok: true };
}

// ── Named delivery locations (the API sync key is `code`) ───────────────────

export async function saveLocation(formData: FormData): Promise<ActionResult> {
  const customerId = (formData.get("customerId") as string) || "";
  const data = {
    code: ((formData.get("code") as string) ?? "").trim().toUpperCase().replace(/\s+/g, "-"),
    name: ((formData.get("name") as string) ?? "").trim(),
    address: ((formData.get("address") as string) ?? "").trim(),
    contact: ((formData.get("contact") as string) ?? "").trim() || null,
  };
  if (!customerId || !data.code || !data.name || !data.address) {
    return { ok: false, error: "Code, name and address are required" };
  }
  try {
    const count = await db.customerLocation.count({ where: { customerId } });
    await db.customerLocation.create({
      // First location becomes the default automatically.
      data: { customerId, ...data, isDefault: count === 0 },
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/customers");
  return { ok: true };
}

export async function setDefaultLocation(id: string): Promise<ActionResult> {
  const location = await db.customerLocation.findUnique({ where: { id } });
  if (!location) return { ok: false, error: "Location not found" };
  await db.$transaction([
    db.customerLocation.updateMany({
      where: { customerId: location.customerId },
      data: { isDefault: false },
    }),
    db.customerLocation.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteLocation(id: string): Promise<ActionResult> {
  const orders = await db.salesOrder.count({ where: { deliveryLocationId: id } });
  if (orders > 0) {
    return { ok: false, error: "Cannot delete, sales orders reference this location." };
  }
  try {
    await db.customerLocation.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const orders = await db.salesOrder.count({ where: { customerId: id } });
  if (orders > 0) {
    return { ok: false, error: "Cannot delete, this customer has sales orders." };
  }
  try {
    await db.customer.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/customers");
  return { ok: true };
}


// ── B2B portal management: price lists and buyer access ─────────────────────

import { requireOrgAdmin } from "@/lib/auth";
import { generateToken } from "@/lib/auth-crypto";
import { parsePoundsToPence } from "@/lib/money";

export async function saveCustomerPrice(input: {
  customerId: string;
  productId: string;
  pricePounds: string;
}): Promise<ActionResult> {
  const pence = parsePoundsToPence(input.pricePounds);
  if (pence == null || pence < 0) return { ok: false, error: "Enter a price like 5.49" };
  if (!input.productId) return { ok: false, error: "Choose a product" };
  await db.customerPrice.upsert({
    where: { customerId_productId: { customerId: input.customerId, productId: input.productId } },
    create: { customerId: input.customerId, productId: input.productId, unitPricePence: pence },
    update: { unitPricePence: pence },
  });
  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteCustomerPrice(id: string): Promise<ActionResult> {
  await db.customerPrice.delete({ where: { id } });
  revalidatePath("/customers");
  return { ok: true };
}

const PORTAL_INVITE_DAYS = 7;

export async function invitePortalUser(input: {
  customerId: string;
  email: string;
}): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address" };
  }
  const existing = await db.portalUser.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "That email already has portal access" };
  const token = generateToken();
  await db.portalInvitation.upsert({
    where: { customerId_email: { customerId: input.customerId, email } },
    create: {
      customerId: input.customerId,
      email,
      token,
      invitedById: admin.id,
      expiresAt: new Date(Date.now() + PORTAL_INVITE_DAYS * 24 * 60 * 60 * 1000),
    },
    update: {
      token,
      invitedById: admin.id,
      expiresAt: new Date(Date.now() + PORTAL_INVITE_DAYS * 24 * 60 * 60 * 1000),
      acceptedAt: null,
    },
  });
  revalidatePath("/customers");
  return { ok: true, link: `/portal/invite/${token}` };
}

export async function revokePortalInvitation(id: string): Promise<ActionResult> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  await db.portalInvitation.deleteMany({ where: { id, acceptedAt: null } });
  revalidatePath("/customers");
  return { ok: true };
}

export async function removePortalUser(id: string): Promise<ActionResult> {
  const admin = await requireOrgAdmin();
  if ("error" in admin) return { ok: false, error: admin.error };
  await db.portalUser.delete({ where: { id } });
  revalidatePath("/customers");
  return { ok: true };
}
