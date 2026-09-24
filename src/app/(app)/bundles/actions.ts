"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

export interface BomInput {
  componentId: string;
  quantity: number;
}

export async function saveBom(
  bundleId: string,
  lines: BomInput[],
  outputQty = 1,
): Promise<ActionResult> {
  const bundle = await db.product.findUnique({ where: { id: bundleId } });
  if (!bundle || (bundle.type !== "BUNDLE" && bundle.type !== "ASSEMBLED")) {
    return { ok: false, error: "Not a bundle" };
  }
  // Recipe yield: only assembled products batch; bundles are always per-unit.
  if (bundle.type === "ASSEMBLED") {
    if (!Number.isInteger(outputQty) || outputQty < 1) {
      return { ok: false, error: "Recipe output must be a whole number of at least 1" };
    }
  } else {
    outputQty = 1;
  }
  const cleaned = lines.filter((l) => l.componentId && l.quantity > 0);
  const ids = cleaned.map((l) => l.componentId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "Each component can appear only once" };
  }
  const components = await db.product.findMany({ where: { id: { in: ids } } });
  const nonStandard = components.find((c) => c.type !== "STANDARD");
  if (nonStandard) {
    // Bundle-of-bundle is deliberately unsupported (standard virtual-bundle behaviour).
    return {
      ok: false,
      error: `${nonStandard.sku} is a bundle, bundles can only contain standard products`,
    };
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.bomLine.deleteMany({ where: { bundleId } });
      if (cleaned.length > 0) {
        await tx.bomLine.createMany({
          data: cleaned.map((l) => ({ bundleId, ...l })),
        });
      }
      // BOM edits are a modification of the bundle document itself.
      await tx.product.update({
        where: { id: bundleId },
        data: { updatedAt: new Date(), bomOutputQty: outputQty },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
  revalidatePath("/bundles");
  revalidatePath(`/bundles/${bundleId}`);
  revalidatePath("/stock");
  revalidatePath("/channels");
  return { ok: true };
}
