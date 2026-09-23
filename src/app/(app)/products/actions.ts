"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parsePoundsToPence } from "@/lib/money";

export type ActionResult = { ok: true } | { ok: false; error: string };

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

async function storeImage(file: File, sku: string): Promise<string | null> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new Error("Image must be PNG, JPEG, WebP or SVG");
  if (file.size > 4 * 1024 * 1024) throw new Error("Image must be under 4 MB");
  const dir = path.join(process.cwd(), "public", "product-images");
  await mkdir(dir, { recursive: true });
  const filename = `${sku.toLowerCase()}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
  return `/product-images/${filename}`;
}

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  const id = (formData.get("id") as string) || null;
  const baseCostPence = parsePoundsToPence((formData.get("baseCost") as string) ?? "");
  const sellPricePence = parsePoundsToPence((formData.get("sellPrice") as string) ?? "");
  const type = (formData.get("type") as string) === "BUNDLE" ? "BUNDLE" : "STANDARD";
  const data = {
    sku: ((formData.get("sku") as string) ?? "").trim().toUpperCase(),
    name: ((formData.get("name") as string) ?? "").trim(),
    barcode: ((formData.get("barcode") as string) ?? "").trim() || null,
    weightGrams: Number(formData.get("weightGrams") ?? 0) || 0,
    baseCostPence: baseCostPence ?? 0,
    sellPricePence: sellPricePence ?? 0,
    type,
    supplierId: ((formData.get("supplierId") as string) || null) === "none"
      ? null
      : ((formData.get("supplierId") as string) || null),
    familyId: ((formData.get("familyId") as string) || null) === "none"
      ? null
      : ((formData.get("familyId") as string) || null),
    variant: ((formData.get("variant") as string) ?? "").trim() || null,
    categoryId: ((formData.get("categoryId") as string) || null) === "none"
      ? null
      : ((formData.get("categoryId") as string) || null),
    brandId: ((formData.get("brandId") as string) || null) === "none"
      ? null
      : ((formData.get("brandId") as string) || null),
  };
  if (!data.sku || !data.name) {
    return { ok: false, error: "SKU and name are required" };
  }
  try {
    const image = formData.get("image");
    let imageUrl: string | undefined;
    if (image instanceof File && image.size > 0) {
      imageUrl = (await storeImage(image, data.sku)) ?? undefined;
    }
    if (id) {
      await db.product.update({ where: { id }, data: { ...data, ...(imageUrl ? { imageUrl } : {}) } });
    } else {
      await db.product.create({ data: { ...data, imageUrl: imageUrl ?? null } });
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/products");
  revalidatePath("/bundles");
  return { ok: true };
}

export async function saveFamily(formData: FormData): Promise<ActionResult> {
  return saveGroup("family", formData);
}

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  return saveGroup("category", formData);
}

export async function saveBrand(formData: FormData): Promise<ActionResult> {
  return saveGroup("brand", formData);
}

async function saveGroup(
  kind: "family" | "category" | "brand",
  formData: FormData,
): Promise<ActionResult> {
  const name = ((formData.get("name") as string) ?? "").trim();
  const code = ((formData.get("code") as string) ?? "").trim().toUpperCase();
  if (!name || !code) return { ok: false, error: "Name and code are required" };
  try {
    if (kind === "family") await db.productFamily.create({ data: { name, code } });
    if (kind === "category") await db.category.create({ data: { name, code } });
    if (kind === "brand") await db.brand.create({ data: { name, code } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/products");
  return { ok: true };
}

// ── Pack configurations (alternate selling units) ───────────────────────────
// GS1-style outers: a pack/case is its own orderable unit with its own GTIN.
// Stock stays in eaches; order lines snapshot the conversion when sold.

export async function saveProductUom(input: {
  productId: string;
  code: string;
  name: string;
  unitsPerUom: number;
  barcode: string | null;
}): Promise<ActionResult> {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "-");
  const name = input.name.trim();
  if (!code || !name) return { ok: false, error: "Code and name are required" };
  if (!Number.isInteger(input.unitsPerUom) || input.unitsPerUom < 2) {
    return { ok: false, error: "Units per pack must be a whole number ≥ 2 (1 is just an each)" };
  }
  const product = await db.product.findUnique({ where: { id: input.productId } });
  if (!product) return { ok: false, error: "Product not found" };
  if (product.type === "BUNDLE") {
    return { ok: false, error: "Bundles are sold in eaches, pack units apply to standard products" };
  }
  const barcode = input.barcode?.trim() || null;
  try {
    await db.productUom.upsert({
      where: { productId_code: { productId: input.productId, code } },
      create: { productId: input.productId, code, name, unitsPerUom: input.unitsPerUom, barcode },
      update: { name, unitsPerUom: input.unitsPerUom, barcode },
    });
    await db.product.update({ where: { id: input.productId }, data: { updatedAt: new Date() } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return {
      ok: false,
      error: message.includes("Unique") || message.includes("unique")
        ? "That barcode is already in use on another product or pack"
        : message,
    };
  }
  revalidatePath("/products");
  revalidatePath(`/products/${input.productId}`);
  return { ok: true };
}

export async function deleteProductUom(id: string): Promise<ActionResult> {
  const uom = await db.productUom.findUnique({ where: { id } });
  if (!uom) return { ok: false, error: "Pack configuration not found" };
  // Order lines keep their snapshot (uomCode + unitsPerUom), so history is safe.
  await db.$transaction([
    db.productUom.delete({ where: { id } }),
    db.product.update({ where: { id: uom.productId }, data: { updatedAt: new Date() } }),
  ]);
  revalidatePath("/products");
  revalidatePath(`/products/${uom.productId}`);
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  try {
    await db.bomLine.deleteMany({ where: { bundleId: id } });
    await db.product.delete({ where: { id } });
  } catch {
    return {
      ok: false,
      error: "Cannot delete, this product is referenced by orders, stock or bundles.",
    };
  }
  revalidatePath("/products");
  revalidatePath("/bundles");
  return { ok: true };
}
