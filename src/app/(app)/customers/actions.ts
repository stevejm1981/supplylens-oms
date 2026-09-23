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
