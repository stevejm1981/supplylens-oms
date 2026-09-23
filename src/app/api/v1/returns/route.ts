import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const [rmas, rtvs] = await Promise.all([
    db.customerReturn.findMany({
      where: since ? { updatedAt: { gt: since } } : undefined,
      orderBy: { reference: "asc" },
      include: {
        salesOrder: { select: { reference: true, customer: { select: { code: true } } } },
        warehouse: { select: { code: true } },
        creditNote: { select: { number: true } },
        lines: { include: { orderLine: { include: { product: { select: { sku: true } } } } } },
      },
    }),
    db.supplierReturn.findMany({
      where: since ? { updatedAt: { gt: since } } : undefined,
      orderBy: { reference: "asc" },
      include: {
        supplier: { select: { code: true } },
        warehouse: { select: { code: true } },
        lines: { include: { product: { select: { sku: true } } } },
      },
    }),
  ]);
  return NextResponse.json({
    customerReturns: rmas.map((r) => ({
      reference: r.reference,
      updatedAt: r.updatedAt,
      salesOrder: r.salesOrder.reference,
      customer: r.salesOrder.customer.code,
      warehouse: r.warehouse.code,
      status: r.status,
      reason: r.reason,
      receivedAt: r.receivedAt,
      creditNote: r.creditNote?.number ?? null,
      lines: r.lines.map((l) => ({
        sku: l.orderLine.product.sku,
        quantity: l.quantity,
        restockQty: l.restockQty,
        writeOffQty: l.writeOffQty,
      })),
    })),
    supplierReturns: rtvs.map((r) => ({
      reference: r.reference,
      updatedAt: r.updatedAt,
      supplier: r.supplier.code,
      warehouse: r.warehouse.code,
      status: r.status,
      reason: r.reason,
      sentAt: r.sentAt,
      lines: r.lines.map((l) => ({
        sku: l.product.sku,
        quantity: l.quantity,
        unitCostPence: l.unitCostPence,
      })),
    })),
  });
}
