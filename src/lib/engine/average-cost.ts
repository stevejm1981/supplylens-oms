// Average landed cost, computed on demand from cost tranches. Pure functions only.
// With no outbound transactions in the prototype, the weighted average over all
// inbound tranches equals a moving average, and late-arriving cost invoices
// (freight billed weeks after receipt) re-price history correctly for free.
// A real system with sales would need dated cost layers; deliberately punted.

export interface CostTranche {
  quantity: number;
  /** Unit cost in (possibly fractional) pence, landed for receipts, opening cost for seeds. */
  unitCostPence: number;
}

/** Weighted-average unit cost in fractional pence, or null when there is no stock. */
export function computeAvgLandedCost(tranches: CostTranche[]): number | null {
  let totalQty = 0;
  let totalCost = 0;
  for (const t of tranches) {
    if (t.quantity <= 0) continue;
    totalQty += t.quantity;
    totalCost += t.quantity * t.unitCostPence;
  }
  if (totalQty === 0) return null;
  return totalCost / totalQty;
}
