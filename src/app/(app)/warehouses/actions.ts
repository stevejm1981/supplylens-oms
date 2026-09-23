"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveWarehouse(formData: FormData): Promise<ActionResult> {
  const id = (formData.get("id") as string) || null;
  const data = {
    name: ((formData.get("name") as string) ?? "").trim(),
    code: ((formData.get("code") as string) ?? "").trim().toUpperCase(),
    notes: ((formData.get("notes") as string) ?? "").trim() || null,
  };
  const makeDefault = formData.get("isDefault") === "on";
  if (!data.name || !data.code) {
    return { ok: false, error: "Name and code are required" };
  }
  try {
    await db.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.warehouse.updateMany({ data: { isDefault: false } });
      }
      if (id) {
        await tx.warehouse.update({ where: { id }, data: { ...data, isDefault: makeDefault } });
      } else {
        const count = await tx.warehouse.count();
        // First warehouse is always the default.
        await tx.warehouse.create({
          data: { ...data, isDefault: makeDefault || count === 0 },
        });
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/warehouses");
  return { ok: true };
}

export async function deleteWarehouse(id: string): Promise<ActionResult> {
  const inUse = await db.stockLevel.count({ where: { warehouseId: id } });
  const orders = await db.salesOrder.count({ where: { warehouseId: id } });
  if (inUse > 0 || orders > 0) {
    return {
      ok: false,
      error: "Cannot delete, this warehouse holds stock or has sales orders against it.",
    };
  }
  try {
    await db.warehouse.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/warehouses");
  return { ok: true };
}
