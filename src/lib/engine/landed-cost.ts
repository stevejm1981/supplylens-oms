// Landed-cost allocation engine. Pure functions only, no Prisma, no Next.
// All amounts are integer pence. Allocation uses the largest remainder method
// so the allocated amounts always sum EXACTLY to the invoice amount.

export type AllocationMethod = "VALUE" | "QUANTITY" | "WEIGHT";

export interface AllocatableLine {
  lineId: string;
  quantity: number;
  unitCostPence: number;
  unitWeightGrams: number;
}

export interface AllocationResult {
  lineId: string;
  /** The line's weighting under the chosen method (pence of value / units / grams). */
  basis: number;
  /** basis / totalBasis, for display ("31.4%"). */
  share: number;
  /** Integer pence. Sums exactly to the invoice amount across all lines. */
  amountPence: number;
}

export interface AllocationOutcome {
  results: AllocationResult[];
  /** True when the chosen method had zero total basis and an equal split was used instead. */
  fallback: boolean;
}

function lineBasis(line: AllocatableLine, method: AllocationMethod): number {
  switch (method) {
    case "VALUE":
      return line.quantity * line.unitCostPence;
    case "QUANTITY":
      return line.quantity;
    case "WEIGHT":
      return line.quantity * line.unitWeightGrams;
  }
}

export function allocateInvoice(
  invoiceAmountPence: number,
  method: AllocationMethod,
  lines: AllocatableLine[],
): AllocationOutcome {
  if (lines.length === 0) {
    throw new Error("Cannot allocate an invoice across zero lines");
  }
  if (!Number.isInteger(invoiceAmountPence) || invoiceAmountPence < 0) {
    throw new Error("Invoice amount must be a non-negative integer (pence)");
  }

  let bases = lines.map((l) => lineBasis(l, method));
  let totalBasis = bases.reduce((a, b) => a + b, 0);
  let fallback = false;

  if (totalBasis === 0) {
    // e.g. WEIGHT method but no weights captured, equal split, flagged for the UI.
    bases = lines.map(() => 1);
    totalBasis = lines.length;
    fallback = true;
  }

  const raw = bases.map((b) => (invoiceAmountPence * b) / totalBasis);
  const floored = raw.map(Math.floor);
  let remainder = invoiceAmountPence - floored.reduce((a, b) => a + b, 0);

  // Largest remainder: hand the leftover pence to the lines with the biggest
  // fractional parts; ties broken by input order for determinism.
  const order = raw
    .map((r, i) => ({ i, frac: r - floored[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);

  const amounts = [...floored];
  for (const { i } of order) {
    if (remainder <= 0) break;
    amounts[i] += 1;
    remainder -= 1;
  }

  const total = amounts.reduce((a, b) => a + b, 0);
  if (total !== invoiceAmountPence) {
    throw new Error(
      `Allocation invariant broken: allocated ${total}p of ${invoiceAmountPence}p`,
    );
  }

  return {
    fallback,
    results: lines.map((l, i) => ({
      lineId: l.lineId,
      basis: bases[i],
      share: bases[i] / totalBasis,
      amountPence: amounts[i],
    })),
  };
}

/**
 * Landed unit cost in (possibly fractional) pence, display only.
 * Totals must always be derived from allocated pence, never unit × qty.
 */
export function landedUnitCostPence(
  unitCostPence: number,
  quantity: number,
  allocatedPence: number,
): number {
  if (quantity === 0) return unitCostPence;
  return unitCostPence + allocatedPence / quantity;
}
