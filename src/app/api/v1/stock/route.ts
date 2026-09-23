// Availability feed, what an integration should broadcast to channels.
// Available already excludes committed (incl. pre-orders) and reserved stock.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAvailability, getAvailableEffectiveStockMap } from "@/lib/queries";
import { requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;

  const [products, { byProduct }, effective] = await Promise.all([
    db.product.findMany({ orderBy: { sku: "asc" } }),
    getAvailability(),
    getAvailableEffectiveStockMap(),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    items: products.map((p) => {
      const a = byProduct.get(p.id);
      return {
        sku: p.sku,
        name: p.name,
        type: p.type,
        onHand: p.type === "BUNDLE" ? null : (a?.onHand ?? 0),
        committed: p.type === "BUNDLE" ? null : (a?.committed ?? 0),
        preOrdered: p.type === "BUNDLE" ? null : (a?.preOrdered ?? 0),
        reserved: p.type === "BUNDLE" ? null : (a?.reserved ?? 0),
        onOrder: p.type === "BUNDLE" ? null : (a?.onOrder ?? 0),
        available: effective.get(p.id) ?? 0, // bundles: derived from components
      };
    }),
  });
}
