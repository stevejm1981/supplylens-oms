import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const credits = await db.creditNote.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { number: "asc" },
    include: {
      salesOrder: { select: { reference: true, customer: { select: { code: true } } } },
      customerReturn: { select: { reference: true } },
      lines: { include: { product: { select: { sku: true } } } },
    },
  });
  return NextResponse.json({
    items: credits.map((c) => ({
      number: c.number,
      updatedAt: c.updatedAt,
      salesOrder: c.salesOrder.reference,
      customer: c.salesOrder.customer.code,
      reason: c.reason,
      customerReturn: c.customerReturn?.reference ?? null,
      restock: c.restock,
      creditDate: c.creditDate,
      netPence: c.netPence,
      vatPence: c.vatPence,
      grossPence: c.grossPence,
      lines: c.lines.map((l) => ({
        sku: l.product.sku,
        quantity: l.quantity,
        unitPricePence: l.unitPricePence,
      })),
    })),
  });
}
