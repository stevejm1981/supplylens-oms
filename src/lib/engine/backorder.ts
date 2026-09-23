// Back-order maths, pure. An order is back-ordered when its outstanding
// demand (base units, bundles exploded upstream) exceeds what the company can
// actually promise. Available already nets ALL commitments (including this
// order's own), so a negative available IS the oversell; this order's share
// of it is capped at its own need, less any cover already raised.

export interface ProductRequirement {
  productId: string;
  sku: string;
  supplierId: string | null;
  supplierName: string | null;
  /** This order's outstanding demand in base units (eaches). */
  outstandingBase: number;
}

export interface ShortfallLine extends ProductRequirement {
  /** Base units this order is short, what a covering PO should buy. */
  shortfall: number;
}

export function computeShortfall(
  requirements: ProductRequirement[],
  /** Company-wide available per product (onHand − committed − reserved). */
  availableByProduct: Map<string, number>,
  /** Base units already covered by existing pending holds for this order. */
  coveredByProduct: Map<string, number> = new Map(),
): ShortfallLine[] {
  const result: ShortfallLine[] = [];
  for (const req of requirements) {
    if (req.outstandingBase <= 0) continue;
    const available = availableByProduct.get(req.productId) ?? 0;
    if (available >= 0) continue; // company can supply everyone, not short
    const oversell = -available;
    const alreadyCovered = coveredByProduct.get(req.productId) ?? 0;
    const shortfall = Math.min(req.outstandingBase, oversell) - alreadyCovered;
    if (shortfall > 0) result.push({ ...req, shortfall });
  }
  return result;
}
