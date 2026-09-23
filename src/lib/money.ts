// Money display/parse helpers. Storage is always integer pence.

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

/** £1,234.56 from integer (or fractional, e.g. landed unit cost) pence. */
export function formatPence(pence: number | null | undefined, dp = 2): string {
  if (pence === null || pence === undefined) return ", ";
  if (dp === 2) return gbp.format(pence / 100);
  return `£${(pence / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: dp,
  })}`;
}

/** "12.34" | "£12.34" | "1,234.5" → integer pence (rounded). NaN-safe: returns null. */
export function parsePoundsToPence(input: string): number | null {
  const cleaned = input.replace(/[£,\s]/g, "");
  if (cleaned === "") return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function formatPercent(share: number): string {
  return `${(share * 100).toLocaleString("en-GB", { maximumFractionDigits: 1 })}%`;
}

export function formatGrams(grams: number): string {
  if (grams >= 1000) {
    return `${(grams / 1000).toLocaleString("en-GB", { maximumFractionDigits: 2 })} kg`;
  }
  return `${grams} g`;
}
