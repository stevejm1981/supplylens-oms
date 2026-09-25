// Price resolution, pure. The order of truth for what a customer pays per
// ordered unit: their price-list price if one exists, otherwise the product's
// standard sell price, multiplied by the pack factor. Integer pence out.

export interface PriceInputs {
  customerPricePence?: number | null; // per each, from the customer's list
  sellPricePence: number; // per each, the standard price
  unitsPerUom?: number; // pack factor, 1 for eaches
}

export function resolveUnitPrice({
  customerPricePence,
  sellPricePence,
  unitsPerUom = 1,
}: PriceInputs): number {
  const perEach =
    customerPricePence != null && customerPricePence >= 0
      ? customerPricePence
      : sellPricePence;
  return Math.round(perEach * unitsPerUom);
}

export type StockBand = "IN" | "LOW" | "OUT";

/** What buyers see instead of exact numbers. */
export const LOW_STOCK_THRESHOLD = 25;

export function stockBand(available: number): StockBand {
  if (available <= 0) return "OUT";
  if (available < LOW_STOCK_THRESHOLD) return "LOW";
  return "IN";
}

export const stockBandLabels: Record<StockBand, string> = {
  IN: "In stock",
  LOW: "Low stock",
  OUT: "Out of stock",
};
