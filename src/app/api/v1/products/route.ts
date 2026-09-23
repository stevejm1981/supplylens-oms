import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvgLandedCosts } from "@/lib/queries";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const [products, avgCosts] = await Promise.all([
    db.product.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
      orderBy: { sku: "asc" },
      include: {
        supplier: { select: { code: true } },
        family: { select: { code: true, name: true } },
        category: { select: { code: true, name: true } },
        brand: { select: { code: true, name: true } },
        bomLines: { include: { component: { select: { sku: true } } } },
        uoms: { orderBy: { unitsPerUom: "asc" } },
      },
    }),
    getAvgLandedCosts(),
  ]);
  return NextResponse.json({
    items: products.map((p) => ({
      sku: p.sku,
      updatedAt: p.updatedAt,
      name: p.name,
      type: p.type,
      barcode: p.barcode,
      // Alternate selling units, order lines may reference these by code or
      // by outer barcode. Stock itself is always tracked in eaches.
      uoms: p.uoms.map((u) => ({
        code: u.code,
        name: u.name,
        unitsPerUom: u.unitsPerUom,
        barcode: u.barcode,
      })),
      weightGrams: p.weightGrams,
      baseCostPence: p.baseCostPence,
      sellPricePence: p.sellPricePence,
      avgLandedCostPence: avgCosts.get(p.id) ?? null,
      supplier: p.supplier?.code ?? null,
      family: p.family ? { code: p.family.code, name: p.family.name, variant: p.variant } : null,
      category: p.category?.code ?? null,
      brand: p.brand?.code ?? null,
      imageUrl: p.imageUrl,
      bom:
        p.type === "BUNDLE"
          ? p.bomLines.map((b) => ({ sku: b.component.sku, quantity: b.quantity }))
          : undefined,
    })),
  });
}
