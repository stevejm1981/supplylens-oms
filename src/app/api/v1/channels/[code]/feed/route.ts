// The channel stock feed as JSON, what an integration pushes to the channel.
// Runs the channel's rule pipeline over AVAILABILITY (never raw stock).

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAvailableEffectiveStockMap } from "@/lib/queries";
import { buildChannelFeed, parseRules } from "@/lib/engine/channel-rules";
import { requireApiKey } from "../../../auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { code } = await params;
  const channel = await db.channel.findUnique({ where: { code } });
  if (!channel) {
    return NextResponse.json({ ok: false, error: "Channel not found" }, { status: 404 });
  }
  const [products, effective] = await Promise.all([
    db.product.findMany({ orderBy: { sku: "asc" } }),
    getAvailableEffectiveStockMap(),
  ]);
  const items = products
    .filter((p) => channel.includeBundles || p.type !== "BUNDLE")
    .map((p) => ({ sku: p.sku, effectiveQty: effective.get(p.id) ?? 0 }));
  return NextResponse.json({
    channel: channel.code,
    generatedAt: new Date().toISOString(),
    items: buildChannelFeed(items, parseRules(channel.rulesJson)),
  });
}
