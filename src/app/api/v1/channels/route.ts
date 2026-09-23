import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseRules } from "@/lib/engine/channel-rules";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const channels = await db.channel.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { code: "asc" },
    include: { _count: { select: { salesOrders: true } } },
  });
  return NextResponse.json({
    items: channels.map((c) => ({
      code: c.code,
      updatedAt: c.updatedAt,
      name: c.name,
      includeBundles: c.includeBundles,
      rules: parseRules(c.rulesJson),
      salesOrderCount: c._count.salesOrders,
    })),
  });
}
