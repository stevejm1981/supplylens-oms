// DB-facing back-order assessment, shared by the order page (display) and the
// cover-shortfall action (so what you see is exactly what gets bought).

import { db } from "@/lib/db";
import { getAvailability } from "@/lib/queries";
import { computeShortfall, type ShortfallLine } from "@/lib/engine/backorder";

export interface OrderCoverage {
  reservationId: string;
  reference: string;
  sku: string;
  quantity: number;
  status: string;
  poReference: string | null;
  poId: string | null;
  poExpectedDate: Date | null;
}

export interface BackorderView {
  shortfalls: ShortfallLine[];
  coverage: OrderCoverage[];
}

export async function getOrderBackorder(orderId: string): Promise<BackorderView> {
  const [order, { byProduct }, holds] = await Promise.all([
    db.salesOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            product: {
              include: {
                bomLines: { include: { component: { include: { supplier: true } } } },
                supplier: true,
              },
            },
            despatchLines: { select: { despatchedQty: true } },
          },
        },
      },
    }),
    getAvailability(),
    db.stockReservation.findMany({
      where: { salesOrderId: orderId, status: { in: ["PENDING", "ACTIVE"] } },
      include: {
        product: { select: { sku: true } },
        purchaseOrder: { select: { id: true, reference: true, expectedDate: true } },
      },
    }),
  ]);

  if (order.status === "INVOICED") return { shortfalls: [], coverage: [] };

  // This order's outstanding demand in base units, bundle-exploded.
  const demand = new Map<
    string,
    { sku: string; supplierId: string | null; supplierName: string | null; base: number }
  >();
  const addDemand = (
    productId: string,
    sku: string,
    supplierId: string | null,
    supplierName: string | null,
    base: number,
  ) => {
    const entry = demand.get(productId) ?? { sku, supplierId, supplierName, base: 0 };
    entry.base += base;
    demand.set(productId, entry);
  };
  for (const line of order.lines) {
    const outstandingUom =
      line.quantity - line.despatchLines.reduce((s, d) => s + d.despatchedQty, 0);
    if (outstandingUom <= 0) continue;
    if (line.product.type === "BUNDLE") {
      for (const bom of line.product.bomLines) {
        addDemand(
          bom.componentId,
          bom.component.sku,
          bom.component.supplierId,
          bom.component.supplier?.name ?? null,
          bom.quantity * outstandingUom,
        );
      }
    } else {
      addDemand(
        line.productId,
        line.product.sku,
        line.product.supplierId,
        line.product.supplier?.name ?? null,
        outstandingUom * line.unitsPerUom,
      );
    }
  }

  const covered = new Map<string, number>();
  for (const h of holds) {
    covered.set(h.productId, (covered.get(h.productId) ?? 0) + h.quantity);
  }

  const shortfalls = computeShortfall(
    [...demand.entries()].map(([productId, d]) => ({
      productId,
      sku: d.sku,
      supplierId: d.supplierId,
      supplierName: d.supplierName,
      outstandingBase: d.base,
    })),
    new Map([...byProduct.entries()].map(([id, a]) => [id, a.available])),
    covered,
  );

  return {
    shortfalls,
    coverage: holds.map((h) => ({
      reservationId: h.id,
      reference: h.reference,
      sku: h.product.sku,
      quantity: h.quantity,
      status: h.status,
      poReference: h.purchaseOrder?.reference ?? null,
      poId: h.purchaseOrder?.id ?? null,
      poExpectedDate: h.purchaseOrder?.expectedDate ?? null,
    })),
  };
}
