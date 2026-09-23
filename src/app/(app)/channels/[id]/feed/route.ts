import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAvailableEffectiveStockMap } from "@/lib/queries";
import { buildChannelFeed, feedToCsv, parseRules } from "@/lib/engine/channel-rules";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const channel = await db.channel.findUnique({ where: { id } });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const [products, effective] = await Promise.all([
    db.product.findMany({ orderBy: { sku: "asc" } }),
    getAvailableEffectiveStockMap(),
  ]);

  const items = products
    .filter((p) => channel.includeBundles || p.type !== "BUNDLE")
    .map((p) => ({ sku: p.sku, effectiveQty: effective.get(p.id) ?? 0 }));

  const csv = feedToCsv(buildChannelFeed(items, parseRules(channel.rulesJson)));

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${channel.code}-stock-feed.csv"`,
    },
  });
}
