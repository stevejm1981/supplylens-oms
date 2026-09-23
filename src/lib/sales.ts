// Sales maths shared by pages, actions and reports. One definition of a line's
// net value so discounts can never diverge between screens.

export interface NetLine {
  quantity: number;
  unitPricePence: number;
  discountPct?: number | null;
}

/** Line net in integer pence: qty × price × (1 − discount%), rounded. */
export function lineNetPence(line: NetLine): number {
  const pct = line.discountPct ?? 0;
  return Math.round(line.quantity * line.unitPricePence * (1 - pct / 100));
}

/** Effective unit price after discount (fractional pence, display + credit defaults). */
export function effectiveUnitPricePence(line: NetLine): number {
  const pct = line.discountPct ?? 0;
  return line.unitPricePence * (1 - pct / 100);
}

export function linesNetPence(lines: NetLine[]): number {
  return lines.reduce((s, l) => s + lineNetPence(l), 0);
}

export type TaxTreatment = "EXCLUSIVE" | "INCLUSIVE" | "NONE";

export const VAT_RATE = 0.2;

export interface OrderTotals {
  /** Ex-VAT value, the number all revenue/margin reporting uses. */
  netPence: number;
  vatPence: number;
  grossPence: number;
}

/**
 * Xero-style tax treatment. Entered line prices + shipping are either
 * EXCLUSIVE (VAT added on top), INCLUSIVE (VAT extracted from the entered
 * amounts), or NONE (zero VAT).
 */
export function orderTotalsPence(
  lines: NetLine[],
  shippingPence: number,
  taxTreatment: string,
): OrderTotals {
  const entered = linesNetPence(lines) + (shippingPence || 0);
  if (taxTreatment === "INCLUSIVE") {
    const netPence = Math.round(entered / (1 + VAT_RATE));
    return { netPence, vatPence: entered - netPence, grossPence: entered };
  }
  if (taxTreatment === "NONE") {
    return { netPence: entered, vatPence: 0, grossPence: entered };
  }
  const vatPence = Math.round(entered * VAT_RATE);
  return { netPence: entered, vatPence, grossPence: entered + vatPence };
}

/** Ex-VAT order value under its tax treatment, use this for all reporting. */
export function orderNetPence(
  lines: NetLine[],
  shippingPence: number,
  taxTreatment = "EXCLUSIVE",
): number {
  return orderTotalsPence(lines, shippingPence, taxTreatment).netPence;
}

// ── Fill rates (scoping-doc rules) ──────────────────────────────────────────
// Quantity-weighted, with fulfilled quantity CAPPED at the target per line
// before aggregation, so overdelivery on one SKU can't hide another's
// shortage. Never an average of line percentages. Zero denominator → null.

export interface FillLine {
  originalQty: number;
  quantity: number; // confirmed
  despatchedQty: number;
  /** Base units per ordered unit, lines are weighted in eaches so pack and each lines aggregate compatibly. */
  unitsPerUom?: number;
}

export interface FillRates {
  /** confirmed ÷ original */
  confirmation: number | null;
  /** despatched ÷ original */
  dispatchOriginal: number | null;
  /** despatched ÷ confirmed */
  dispatchConfirmed: number | null;
}

export function fillRates(lines: FillLine[]): FillRates {
  let original = 0;
  let confirmed = 0;
  let confirmedCapped = 0;
  let despatchedVsOriginal = 0;
  let despatchedVsConfirmed = 0;
  for (const l of lines) {
    const per = l.unitsPerUom ?? 1;
    original += l.originalQty * per;
    confirmed += l.quantity * per;
    confirmedCapped += Math.min(l.quantity, l.originalQty) * per;
    despatchedVsOriginal += Math.min(l.despatchedQty, l.originalQty) * per;
    despatchedVsConfirmed += Math.min(l.despatchedQty, l.quantity) * per;
  }
  return {
    confirmation: original > 0 ? confirmedCapped / original : null,
    dispatchOriginal: original > 0 ? despatchedVsOriginal / original : null,
    dispatchConfirmed: confirmed > 0 ? despatchedVsConfirmed / confirmed : null,
  };
}

export function formatFill(rate: number | null): string {
  return rate === null ? "N/A" : `${(rate * 100).toFixed(rate * 100 % 1 === 0 ? 0 : 2)}%`;
}

export const taxTreatmentLabels: Record<string, string> = {
  EXCLUSIVE: "Tax exclusive",
  INCLUSIVE: "Tax inclusive",
  NONE: "No VAT",
};
