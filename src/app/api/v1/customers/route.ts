import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const customers = await db.customer.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { code: "asc" },
    include: {
      defaultSalesPerson: { select: { name: true } },
      defaultWarehouse: { select: { code: true } },
      locations: { orderBy: [{ isDefault: "desc" }, { code: "asc" }] },
    },
  });
  return NextResponse.json({
    items: customers.map((c) => ({
      code: c.code,
      updatedAt: c.updatedAt,
      name: c.name,
      email: c.email,
      phone: c.phone,
      paymentTermsDays: c.paymentTermsDays,
      defaultSalesPerson: c.defaultSalesPerson?.name ?? null,
      defaultWarehouse: c.defaultWarehouse?.code ?? null,
      locations: c.locations.map((l) => ({
        code: l.code,
        name: l.name,
        address: l.address,
        contact: l.contact,
        isDefault: l.isDefault,
      })),
    })),
  });
}
