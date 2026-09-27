// DB-facing batch helpers. All the maths lives in src/lib/engine/fefo, this
// only maps ledger rows into it: batch on-hand is ALWAYS derived from the
// movement ledger, never stored on the batch.

import { db } from "@/lib/db";
import { batchBalances, fefoAllocate, fefoCompare, type FefoBatch } from "@/lib/engine/fefo";

export interface BatchStock extends FefoBatch {
  warehouseId: string;
}

/**
 * FEFO-ordered batches with positive on-hand per product, optionally scoped
 * to one warehouse and a set of products. The list order IS the pick order.
 */
export async function getFefoBatches(
  opts: { productIds?: string[]; warehouseId?: string } = {},
): Promise<Map<string, BatchStock[]>> {
  const batches = await db.stockBatch.findMany({
    where: opts.productIds ? { productId: { in: opts.productIds } } : undefined,
  });
  if (batches.length === 0) return new Map();
  const movements = await db.stockMovement.findMany({
    where: {
      batchId: { in: batches.map((b) => b.id) },
      ...(opts.warehouseId ? { warehouseId: opts.warehouseId } : {}),
    },
    select: { batchId: true, warehouseId: true, quantity: true },
  });
  const balances = batchBalances(movements);
  const result = new Map<string, BatchStock[]>();
  for (const b of batches) {
    const perWarehouse = balances.get(b.id);
    if (!perWarehouse) continue;
    for (const [warehouseId, onHand] of perWarehouse) {
      if (onHand <= 0) continue;
      const list = result.get(b.productId) ?? [];
      list.push({
        batchId: b.id,
        batchRef: b.batchRef,
        bestBefore: b.bestBefore,
        receivedAt: b.receivedAt,
        onHand,
        warehouseId,
      });
      result.set(b.productId, list);
    }
  }
  for (const list of result.values()) list.sort(fefoCompare);
  return result;
}

export interface BatchSuggestion {
  batchRef: string;
  bestBefore: Date | null;
  quantity: number;
}

/**
 * A stateful "take lot" suggester over a FEFO pool: each call allocates and
 * DEPLETES the pool, so several lines of the same product on one pick list
 * never suggest the same units twice.
 */
export function makeFefoSuggester(pool: Map<string, BatchStock[]>) {
  return (productId: string, quantity: number): BatchSuggestion[] => {
    const list = pool.get(productId);
    if (!list || list.length === 0) return [];
    const { allocations } = fefoAllocate(list, quantity);
    return allocations.map((a) => {
      const batch = list.find((b) => b.batchId === a.batchId)!;
      batch.onHand -= a.quantity;
      return { batchRef: a.batchRef, bestBefore: batch.bestBefore, quantity: a.quantity };
    });
  };
}
