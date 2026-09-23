"use server";

import { revalidatePath } from "next/cache";
import { importEntityCsv, type ImportOutcome } from "@/lib/data-transfer";

export async function importData(formData: FormData): Promise<ImportOutcome> {
  const entity = formData.get("entity");
  const file = formData.get("file");
  if (typeof entity !== "string" || !(file instanceof File) || file.size === 0) {
    return { ok: false, created: 0, updated: 0, errors: ["choose a CSV file first"] };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, created: 0, updated: 0, errors: ["file must be under 10 MB"] };
  }
  const outcome = await importEntityCsv(entity, await file.text());
  if (outcome.ok) {
    // Imports can touch most registers, refresh broadly.
    for (const path of [
      "/data",
      "/products",
      "/bundles",
      "/suppliers",
      "/customers",
      "/salespeople",
      "/warehouses",
      "/stock",
      "/movements",
      "/reports",
      "/dashboard",
    ]) {
      revalidatePath(path);
    }
  }
  return outcome;
}
