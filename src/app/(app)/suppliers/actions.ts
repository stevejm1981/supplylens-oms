"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveSupplier(formData: FormData): Promise<ActionResult> {
  const id = (formData.get("id") as string) || null;
  const data = {
    name: ((formData.get("name") as string) ?? "").trim(),
    code: ((formData.get("code") as string) ?? "").trim().toUpperCase(),
    country: ((formData.get("country") as string) ?? "").trim(),
    contactEmail: ((formData.get("contactEmail") as string) ?? "").trim() || null,
    leadTimeDays: formData.get("leadTimeDays")
      ? Number(formData.get("leadTimeDays"))
      : null,
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
  };
  if (!data.name || !data.code || !data.country) {
    return { ok: false, error: "Name, code and country are required" };
  }
  try {
    if (id) {
      await db.supplier.update({ where: { id }, data });
    } else {
      await db.supplier.create({ data });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/suppliers");
  return { ok: true };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  try {
    await db.supplier.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error: "Cannot delete, this supplier has products or purchase orders.",
    };
  }
  revalidatePath("/suppliers");
  return { ok: true };
}
