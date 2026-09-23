"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveSalesPerson(formData: FormData): Promise<ActionResult> {
  const id = (formData.get("id") as string) || null;
  const data = {
    name: ((formData.get("name") as string) ?? "").trim(),
    email: ((formData.get("email") as string) ?? "").trim() || null,
  };
  if (!data.name) return { ok: false, error: "Name is required" };
  try {
    if (id) {
      await db.salesPerson.update({ where: { id }, data });
    } else {
      await db.salesPerson.create({ data });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/salespeople");
  revalidatePath("/customers");
  return { ok: true };
}

export async function deleteSalesPerson(id: string): Promise<ActionResult> {
  const orders = await db.salesOrder.count({ where: { salesPersonId: id } });
  if (orders > 0) {
    return { ok: false, error: "Cannot delete, this salesperson has orders against them." };
  }
  try {
    // Unhook any customer defaults first, then remove.
    await db.$transaction([
      db.customer.updateMany({
        where: { defaultSalesPersonId: id },
        data: { defaultSalesPersonId: null },
      }),
      db.salesPerson.delete({ where: { id } }),
    ]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/salespeople");
  revalidatePath("/customers");
  return { ok: true };
}
