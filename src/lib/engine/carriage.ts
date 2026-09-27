// Carrier cost (cost to serve) engine: the outbound mirror of landed costs.
// A despatch ACCRUES its expected carriage (Dr Cost to Serve / Cr Carriage
// Accruals); the carrier's invoice later matches actual charges to despatches
// and books only the VARIANCE, because the bill itself is coded to Carriage
// Accruals in the ledger app, exactly as supplier bills clear GRNI. Status is
// derived, never stored. Pure functions, no Prisma types.

import {
  allocateInvoice,
  type AllocatableLine,
  type AllocationMethod,
  type AllocationOutcome,
} from "./landed-cost";

export type CarriageStatus = "NONE" | "ACCRUED" | "INVOICED";

/** Where a despatch stands: nothing recorded, accrued only, or carrier-invoiced. */
export function carriageStatus(
  expectedPence: number | null,
  allocatedPence: number,
): CarriageStatus {
  if (allocatedPence > 0) return "INVOICED";
  if (expectedPence != null && expectedPence > 0) return "ACCRUED";
  return "NONE";
}

/** The carriage figure margin should use: actual once invoiced, else the accrual. */
export function effectiveCarriagePence(
  expectedPence: number | null,
  allocatedPence: number,
): number {
  return allocatedPence > 0 ? allocatedPence : (expectedPence ?? 0);
}

export interface JournalDelta {
  /** Positive pence to move; the caller writes Dr/Cr per `direction`. */
  amountPence: number;
  /** "cost" = Dr Cost to Serve / Cr Carriage Accruals; "reversal" = the opposite. */
  direction: "cost" | "reversal";
}

/**
 * Journal for matching an actual carrier charge against a despatch's accrual:
 * only the variance moves (the bill clears the accrual in the ledger app).
 * No accrual → the full actual is the variance. Zero variance → null.
 */
export function matchJournal(
  expectedPence: number | null,
  actualPence: number,
): JournalDelta | null {
  const variance = actualPence - (expectedPence ?? 0);
  if (variance === 0) return null;
  return variance > 0
    ? { amountPence: variance, direction: "cost" }
    : { amountPence: -variance, direction: "reversal" };
}

/**
 * Journal for changing a despatch's expected carriage after it was accrued
 * (raising or lowering the accrual). Zero delta → null.
 */
export function accrualDelta(
  oldExpectedPence: number | null,
  newExpectedPence: number | null,
): JournalDelta | null {
  const delta = (newExpectedPence ?? 0) - (oldExpectedPence ?? 0);
  if (delta === 0) return null;
  return delta > 0
    ? { amountPence: delta, direction: "cost" }
    : { amountPence: -delta, direction: "reversal" };
}

export interface DespatchBasis {
  despatchId: string;
  netValuePence: number; // the despatched goods' net value
  weightGrams: number; // catalogue weight of the despatched goods
}

/**
 * Split one consignment charge across the despatches it covered, reusing the
 * landed-cost allocator (largest remainder, sums exactly). VALUE splits by
 * despatched net value, WEIGHT by goods weight, QUANTITY equally.
 */
export function allocateConsignment(
  amountPence: number,
  method: AllocationMethod,
  despatches: DespatchBasis[],
): AllocationOutcome {
  const lines: AllocatableLine[] = despatches.map((d) => ({
    lineId: d.despatchId,
    quantity: 1,
    unitCostPence: d.netValuePence,
    unitWeightGrams: d.weightGrams,
  }));
  return allocateInvoice(amountPence, method, lines);
}
