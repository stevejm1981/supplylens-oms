// DB-facing aggregation helpers. These map Prisma rows into the pure engines,
// all pricing/stock maths lives in src/lib/engine, never here.

import { db } from "@/lib/db";
import { computeAvgLandedCost, type CostTranche } from "@/lib/engine/average-cost";
import { landedUnitCostPence } from "@/lib/engine/landed-cost";
import { computeEffectiveStock } from "@/lib/engine/bundle-stock";

/** Total physical stock per product (sum across locations). */
export async function getStockByProduct(): Promise<Map<string, number>> {
  const levels = await db.stockLevel.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
  });
  return new Map(levels.map((l) => [l.productId, l._sum.quantity ?? 0]));
}

export interface ProductTranche extends CostTranche {
  label: string;
}

/**
 * Cost tranches per product: opening stock + every RECEIVED PO line at its
 * landed unit cost (base + allocated invoice costs). Computed on demand so
 * cost invoices attached after receipt re-price history correctly.
 */
export async function getTranchesByProduct(): Promise<Map<string, ProductTranche[]>> {
  const [levels, receivedLines, completedBuilds] = await Promise.all([
    db.stockLevel.findMany({ include: { warehouse: { select: { name: true } } } }),
    db.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: "RECEIVED" } },
      include: { allocations: true, purchaseOrder: { select: { reference: true } } },
    }),
    db.productionOrder.findMany({
      where: { status: "COMPLETED" },
      include: { lines: true },
    }),
  ]);

  const map = new Map<string, ProductTranche[]>();
  const push = (productId: string, tranche: ProductTranche) => {
    const list = map.get(productId) ?? [];
    list.push(tranche);
    map.set(productId, list);
  };

  for (const level of levels) {
    if (level.openingQuantity > 0) {
      push(level.productId, {
        label: `Opening, ${level.warehouse.name}`,
        quantity: level.openingQuantity,
        unitCostPence: level.openingUnitCostPence,
      });
    }
  }
  for (const line of receivedLines) {
    const allocated = line.allocations.reduce((s, a) => s + a.amountPence, 0);
    push(line.productId, {
      label: line.purchaseOrder.reference,
      quantity: line.quantity,
      unitCostPence: landedUnitCostPence(line.unitCostPence, line.quantity, allocated),
    });
  }
  // Completed builds: finished goods at actual component value / actual units,
  // so manufactured stock carries its honest rolled-up cost.
  for (const build of completedBuilds) {
    if (!build.actualQty || build.actualQty <= 0) continue;
    const totalValue = build.lines.reduce(
      (s, l) => s + (l.actualQty ?? l.plannedQty) * (l.unitCostPence ?? 0),
      0,
    );
    push(build.productId, {
      label: build.reference,
      quantity: build.actualQty,
      unitCostPence: totalValue / build.actualQty,
    });
  }
  return map;
}

/** Average landed cost per product (fractional pence), null when no tranches. */
export async function getAvgLandedCosts(): Promise<Map<string, number | null>> {
  const tranches = await getTranchesByProduct();
  const result = new Map<string, number | null>();
  for (const [productId, list] of tranches) {
    result.set(productId, computeAvgLandedCost(list));
  }
  return result;
}

// ── Availability: SOH → committed → reserved → available ────────────────────

export interface Availability {
  onHand: number;
  committed: number; // outstanding on open orders (ordered − despatched), bundles exploded
  preOrdered: number; // subset of committed sitting on pre-order flagged orders
  reserved: number; // active stock reservations
  available: number; // onHand − committed − reserved (can go negative = oversold)
  onOrder: number; // inbound on placed POs (global, no warehouse until receipt)
}

const emptyAvailability = (): Availability => ({
  onHand: 0,
  committed: 0,
  preOrdered: 0,
  reserved: 0,
  available: 0,
  onOrder: 0,
});

export async function getAvailability(): Promise<{
  byProduct: Map<string, Availability>;
  byProductWarehouse: Map<string, Availability>; // key `${productId}|${warehouseId}`
}> {
  const now = new Date();
  const [levels, openLines, reservations, inboundLines] = await Promise.all([
    db.stockLevel.findMany(),
    db.salesOrderLine.findMany({
      where: { salesOrder: { status: { in: ["DRAFT", "OPEN"] } } },
      include: {
        despatchLines: { select: { despatchedQty: true } },
        product: { include: { bomLines: true } },
        salesOrder: { select: { warehouseId: true, isPreOrder: true } },
      },
    }),
    db.stockReservation.findMany({
      where: {
        status: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    }),
    db.purchaseOrderLine.findMany({
      where: { purchaseOrder: { status: "PLACED" } },
    }),
  ]);

  const byProduct = new Map<string, Availability>();
  const byProductWarehouse = new Map<string, Availability>();
  const at = (map: Map<string, Availability>, key: string) => {
    const entry = map.get(key) ?? emptyAvailability();
    map.set(key, entry);
    return entry;
  };

  for (const level of levels) {
    at(byProduct, level.productId).onHand += level.quantity;
    at(byProductWarehouse, `${level.productId}|${level.warehouseId}`).onHand +=
      level.quantity;
  }

  for (const line of openLines) {
    const outstandingUom =
      line.quantity - line.despatchLines.reduce((s, d) => s + d.despatchedQty, 0);
    if (outstandingUom <= 0) continue;
    // Commitments are in base units (eaches): pack/case lines multiply by
    // their snapshot factor. UoMs are STANDARD-only, so unitsPerUom is 1 here
    // whenever the bundle branch applies.
    const outstanding = outstandingUom * line.unitsPerUom;
    const commitments =
      line.product.type === "BUNDLE"
        ? line.product.bomLines.map(
            (b) => [b.componentId, b.quantity * outstanding] as const,
          )
        : ([[line.productId, outstanding]] as const);
    for (const [productId, qty] of commitments) {
      const p = at(byProduct, productId);
      const pw = at(byProductWarehouse, `${productId}|${line.salesOrder.warehouseId}`);
      p.committed += qty;
      pw.committed += qty;
      if (line.salesOrder.isPreOrder) {
        p.preOrdered += qty;
        pw.preOrdered += qty;
      }
    }
  }

  for (const r of reservations) {
    at(byProduct, r.productId).reserved += r.quantity;
    at(byProductWarehouse, `${r.productId}|${r.warehouseId}`).reserved += r.quantity;
  }

  for (const line of inboundLines) {
    at(byProduct, line.productId).onOrder += line.quantity;
  }

  for (const map of [byProduct, byProductWarehouse]) {
    for (const entry of map.values()) {
      entry.available = entry.onHand - entry.committed - entry.reserved;
    }
  }

  return { byProduct, byProductWarehouse };
}

/**
 * Sellable AVAILABILITY per product, what channel feeds should broadcast:
 * STANDARD → available (SOH − committed − reserved, floored at 0);
 * bundles → min over components of floor(component available / qty).
 */
export async function getAvailableEffectiveStockMap(): Promise<Map<string, number>> {
  const [{ byProduct }, products, bomLines] = await Promise.all([
    getAvailability(),
    db.product.findMany({ select: { id: true, type: true } }),
    db.bomLine.findMany(),
  ]);
  const availableByProduct = new Map<string, number>();
  for (const p of products) {
    if (p.type !== "BUNDLE") {
      availableByProduct.set(p.id, Math.max(0, byProduct.get(p.id)?.available ?? 0));
    }
  }
  const bundles = new Map<string, { componentId: string; quantity: number }[]>();
  for (const line of bomLines) {
    const list = bundles.get(line.bundleId) ?? [];
    list.push({ componentId: line.componentId, quantity: line.quantity });
    bundles.set(line.bundleId, list);
  }
  for (const p of products) {
    if (p.type === "BUNDLE") {
      const components = bundles.get(p.id) ?? [];
      availableByProduct.set(
        p.id,
        components.length === 0
          ? 0
          : Math.min(
              ...components.map((c) =>
                c.quantity > 0
                  ? Math.floor((availableByProduct.get(c.componentId) ?? 0) / c.quantity)
                  : 0,
              ),
            ),
      );
    }
  }
  return availableByProduct;
}

/**
 * Effective (sellable) stock per product: physical for STANDARD,
 * derived min(floor(component/qty)) for bundles.
 */
export async function getEffectiveStockMap(): Promise<Map<string, number>> {
  const [products, bomLines, stockByProduct] = await Promise.all([
    db.product.findMany({ select: { id: true, type: true } }),
    db.bomLine.findMany(),
    getStockByProduct(),
  ]);
  const bundles = new Map<string, { componentId: string; quantity: number }[]>();
  for (const line of bomLines) {
    const list = bundles.get(line.bundleId) ?? [];
    list.push({ componentId: line.componentId, quantity: line.quantity });
    bundles.set(line.bundleId, list);
  }
  return computeEffectiveStock(
    products,
    [...bundles.entries()].map(([bundleId, components]) => ({ bundleId, components })),
    stockByProduct,
  );
}
