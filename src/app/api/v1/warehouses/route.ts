import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const warehouses = await db.warehouse.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined, orderBy: { code: "asc" } });
  return NextResponse.json({
    items: warehouses.map((w) => ({
      code: w.code,
      updatedAt: w.updatedAt,
      name: w.name,
      isDefault: w.isDefault,
    })),
  });
}
