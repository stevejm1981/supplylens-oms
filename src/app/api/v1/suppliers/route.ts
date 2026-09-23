import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const suppliers = await db.supplier.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined, orderBy: { code: "asc" } });
  return NextResponse.json({
    items: suppliers.map((s) => ({
      code: s.code,
      updatedAt: s.updatedAt,
      name: s.name,
      country: s.country,
      contactEmail: s.contactEmail,
      leadTimeDays: s.leadTimeDays,
    })),
  });
}
