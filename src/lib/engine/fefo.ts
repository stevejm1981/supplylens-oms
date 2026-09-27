// Batch/lot engine: FEFO (first expired, first out) allocation, per-batch
// balances derived from the movement ledger, and receipt progress across
// partial deliveries. Pure functions, no Prisma types.
//
// Batches carry NO stored quantity; their on-hand is always the sum of the
// signed ledger movements that reference them, the same derived-never-stored
// rule the rest of the stock layer follows. Costing is untouched: AVCO
// tranches stay at product level, batches order the picking only.

export interface BatchMovementLine {
  batchId: string | null;
  warehouseId: string;
  quantity: number; // signed
}

/** Per-batch on-hand per warehouse from ledger lines (unbatched rows ignored). */
export function batchBalances(
  movements: BatchMovementLine[],
): Map<string, Map<string, number>> {
  const byBatch = new Map<string, Map<string, number>>();
  for (const m of movements) {
    if (!m.batchId) continue;
    const perWarehouse = byBatch.get(m.batchId) ?? new Map<string, number>();
    perWarehouse.set(m.warehouseId, (perWarehouse.get(m.warehouseId) ?? 0) + m.quantity);
    byBatch.set(m.batchId, perWarehouse);
  }
  return byBatch;
}

export interface FefoBatch {
  batchId: string;
  batchRef: string;
  bestBefore: Date | null;
  receivedAt: Date;
  onHand: number;
}

export interface FefoAllocation {
  batchId: string;
  batchRef: string;
  quantity: number;
}

/** FEFO ordering: earliest best-before first, undated last, then earliest received. */
export function fefoCompare(
  a: { bestBefore: Date | null; receivedAt: Date },
  b: { bestBefore: Date | null; receivedAt: Date },
): number {
  if (a.bestBefore && b.bestBefore && a.bestBefore.getTime() !== b.bestBefore.getTime()) {
    return a.bestBefore.getTime() - b.bestBefore.getTime();
  }
  if (a.bestBefore && !b.bestBefore) return -1;
  if (!a.bestBefore && b.bestBefore) return 1;
  return a.receivedAt.getTime() - b.receivedAt.getTime();
}

/**
 * Allocate a required quantity across batches, earliest best-before first,
 * undated batches last, ties broken by earliest received (physical FIFO).
 * Never over-allocates a batch; whatever the batches cannot cover comes back
 * as `unallocated` (the untracked-history remainder despatches without a
 * batch reference rather than blocking).
 */
export function fefoAllocate(
  batches: FefoBatch[],
  quantity: number,
): { allocations: FefoAllocation[]; unallocated: number } {
  const ordered = [...batches].filter((b) => b.onHand > 0).sort(fefoCompare);
  const allocations: FefoAllocation[] = [];
  let remaining = quantity;
  for (const batch of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(batch.onHand, remaining);
    if (take <= 0) continue;
    allocations.push({ batchId: batch.batchId, batchRef: batch.batchRef, quantity: take });
    remaining -= take;
  }
  return { allocations, unallocated: Math.max(0, remaining) };
}

export type PoReceiptStatus = "PLACED" | "PARTIALLY_RECEIVED" | "RECEIVED";

export interface ReceiptProgress {
  receivedByLine: Map<string, number>;
  outstandingByLine: Map<string, number>; // never negative (over-receipts clamp)
  status: PoReceiptStatus;
}

/**
 * Where a purchase order stands after any number of partial deliveries.
 * A line's outstanding clamps at zero on over-receipt; the order is RECEIVED
 * once every line is fully covered, PLACED while nothing has arrived.
 */
export function receiptProgress(
  poLines: { id: string; quantity: number }[],
  receiptLines: { poLineId: string; quantity: number }[],
): ReceiptProgress {
  const receivedByLine = new Map<string, number>();
  for (const r of receiptLines) {
    receivedByLine.set(r.poLineId, (receivedByLine.get(r.poLineId) ?? 0) + r.quantity);
  }
  const outstandingByLine = new Map<string, number>();
  let anyReceived = false;
  let allCovered = true;
  for (const line of poLines) {
    const received = receivedByLine.get(line.id) ?? 0;
    if (received > 0) anyReceived = true;
    const outstanding = Math.max(0, line.quantity - received);
    if (outstanding > 0) allCovered = false;
    outstandingByLine.set(line.id, outstanding);
  }
  const status: PoReceiptStatus =
    poLines.length > 0 && allCovered ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : "PLACED";
  return { receivedByLine, outstandingByLine, status };
}
