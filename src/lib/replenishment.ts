// DB-facing replenishment aggregation. Velocity comes from the DESPATCH rows
// of the stock ledger, base units, bundle-exploded and pack-converted at the
// moment they happened, so forecasting runs on what physically left, not on
// order paperwork.

import { db } from "@/lib/db";
import { getAvailability, getAvgLandedCosts } from "@/lib/queries";
import {
  assessReplenishment,
  VELOCITY_WINDOW_DAYS,
  type ReplenishmentResult,
} from "@/lib/engine/replenishment";

export interface ReplenishmentRow extends ReplenishmentResult {
  productId: string;
  sku: string;
  name: string;
  supplierId: string | null;
  supplierName: string | null;
  despatchedInWindow: number;
  available: number;
  onOrder: number;
  /** Earliest expected date among placed POs carrying this product. */
  nextInboundDate: Date | null;
  nextInboundRef: string | null;
  /** Base cost for valuing the suggestion (avg landed when known). */
  unitCostPence: number;
}

const statusRank = { OUT: 0, REORDER: 1, WATCH: 2, OK: 3, NO_SALES: 4 } as const;

export async function getReplenishmentRows(): Promise<ReplenishmentRow[]> {
  const since = new Date(Date.now() - VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [products, despatched, { byProduct }, avgCosts, inboundLines] = await Promise.all([
    db.product.findMany({
      where: { type: "STANDARD" },
      orderBy: { sku: "asc" },
      include: { supplier: { select: { id: true, name: true, leadTimeDays: true } } },
    }),
    db.stockMovement.groupBy({
      by: ["productId"],
      where: { type: "DESPATCH", createdAt: { gte: since } },
      _sum: { quantity: true },
    }),
    getAvailability(),
    getAvgLandedCosts(),
    db.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: "PLACED" } },
      include: { purchaseOrder: { select: { reference: true, expectedDate: true } } },
    }),
  ]);

  const despatchedByProduct = new Map(
    despatched.map((d) => [d.productId, Math.abs(d._sum.quantity ?? 0)]),
  );
  const nextInbound = new Map<string, { date: Date | null; ref: string }>();
  for (const line of inboundLines) {
    const current = nextInbound.get(line.productId);
    const date = line.purchaseOrder.expectedDate;
    if (
      !current ||
      (date && (!current.date || date.getTime() < current.date.getTime()))
    ) {
      nextInbound.set(line.productId, { date, ref: line.purchaseOrder.reference });
    }
  }

  const rows = products.map((p) => {
    const a = byProduct.get(p.id);
    const available = a?.available ?? 0;
    const onOrder = a?.onOrder ?? 0;
    const despatchedInWindow = despatchedByProduct.get(p.id) ?? 0;
    const result = assessReplenishment({
      despatchedInWindow,
      windowDays: VELOCITY_WINDOW_DAYS,
      available,
      onOrder,
      leadTimeDays: p.supplier?.leadTimeDays ?? null,
    });
    return {
      ...result,
      productId: p.id,
      sku: p.sku,
      name: p.name,
      supplierId: p.supplier?.id ?? null,
      supplierName: p.supplier?.name ?? null,
      despatchedInWindow,
      available,
      onOrder,
      nextInboundDate: nextInbound.get(p.id)?.date ?? null,
      nextInboundRef: nextInbound.get(p.id)?.ref ?? null,
      unitCostPence: avgCosts.get(p.id) ?? p.baseCostPence,
    };
  });

  // Most urgent first; inside a status band, least cover first.
  rows.sort(
    (a, b) =>
      statusRank[a.status] - statusRank[b.status] ||
      (a.daysOfCover ?? Infinity) - (b.daysOfCover ?? Infinity) ||
      a.sku.localeCompare(b.sku),
  );
  return rows;
}
