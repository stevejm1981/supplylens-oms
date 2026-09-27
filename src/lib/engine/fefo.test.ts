import { describe, expect, it } from "vitest";
import { batchBalances, fefoAllocate, receiptProgress, type FefoBatch } from "./fefo";

const d = (s: string) => new Date(s);

const batch = (over: Partial<FefoBatch> & { batchId: string }): FefoBatch => ({
  batchRef: over.batchId.toUpperCase(),
  bestBefore: null,
  receivedAt: d("2026-01-01"),
  onHand: 0,
  ...over,
});

describe("batchBalances", () => {
  it("sums signed movements per batch per warehouse", () => {
    const balances = batchBalances([
      { batchId: "b1", warehouseId: "w1", quantity: 100 },
      { batchId: "b1", warehouseId: "w1", quantity: -30 },
      { batchId: "b1", warehouseId: "w2", quantity: 10 },
      { batchId: "b2", warehouseId: "w1", quantity: 5 },
    ]);
    expect(balances.get("b1")?.get("w1")).toBe(70);
    expect(balances.get("b1")?.get("w2")).toBe(10);
    expect(balances.get("b2")?.get("w1")).toBe(5);
  });

  it("ignores unbatched movements", () => {
    const balances = batchBalances([{ batchId: null, warehouseId: "w1", quantity: 99 }]);
    expect(balances.size).toBe(0);
  });
});

describe("fefoAllocate", () => {
  it("takes the earliest best-before first and splits across batches", () => {
    const { allocations, unallocated } = fefoAllocate(
      [
        batch({ batchId: "late", bestBefore: d("2027-06-01"), onHand: 50 }),
        batch({ batchId: "early", bestBefore: d("2026-12-01"), onHand: 8 }),
      ],
      12,
    );
    expect(allocations).toEqual([
      { batchId: "early", batchRef: "EARLY", quantity: 8 },
      { batchId: "late", batchRef: "LATE", quantity: 4 },
    ]);
    expect(unallocated).toBe(0);
  });

  it("sorts undated batches last and falls back to received date (FIFO)", () => {
    const { allocations } = fefoAllocate(
      [
        batch({ batchId: "undated-new", receivedAt: d("2026-03-01"), onHand: 10 }),
        batch({ batchId: "undated-old", receivedAt: d("2026-01-01"), onHand: 10 }),
        batch({ batchId: "dated", bestBefore: d("2028-01-01"), receivedAt: d("2026-05-01"), onHand: 10 }),
      ],
      25,
    );
    expect(allocations.map((a) => a.batchId)).toEqual(["dated", "undated-old", "undated-new"]);
  });

  it("caps at what the batches hold and reports the unallocated remainder", () => {
    const { allocations, unallocated } = fefoAllocate(
      [batch({ batchId: "only", bestBefore: d("2026-11-01"), onHand: 3 })],
      10,
    );
    expect(allocations).toEqual([{ batchId: "only", batchRef: "ONLY", quantity: 3 }]);
    expect(unallocated).toBe(7);
  });

  it("skips empty and negative batches and handles zero demand", () => {
    expect(fefoAllocate([batch({ batchId: "empty", onHand: 0 })], 5).allocations).toEqual([]);
    expect(fefoAllocate([batch({ batchId: "b", onHand: 5 })], 0).allocations).toEqual([]);
    expect(fefoAllocate([batch({ batchId: "b", onHand: 5 })], 0).unallocated).toBe(0);
  });
});

describe("receiptProgress", () => {
  const lines = [
    { id: "l1", quantity: 10 },
    { id: "l2", quantity: 4 },
  ];

  it("is PLACED with nothing received", () => {
    const p = receiptProgress(lines, []);
    expect(p.status).toBe("PLACED");
    expect(p.outstandingByLine.get("l1")).toBe(10);
  });

  it("is PARTIALLY_RECEIVED mid-way with per-line outstanding", () => {
    const p = receiptProgress(lines, [
      { poLineId: "l1", quantity: 6 },
      { poLineId: "l2", quantity: 4 },
    ]);
    expect(p.status).toBe("PARTIALLY_RECEIVED");
    expect(p.outstandingByLine.get("l1")).toBe(4);
    expect(p.outstandingByLine.get("l2")).toBe(0);
  });

  it("is RECEIVED when every line is covered, across several deliveries", () => {
    const p = receiptProgress(lines, [
      { poLineId: "l1", quantity: 6 },
      { poLineId: "l1", quantity: 4 },
      { poLineId: "l2", quantity: 4 },
    ]);
    expect(p.status).toBe("RECEIVED");
  });

  it("clamps over-receipt at zero outstanding and still completes", () => {
    const p = receiptProgress(lines, [
      { poLineId: "l1", quantity: 12 },
      { poLineId: "l2", quantity: 4 },
    ]);
    expect(p.status).toBe("RECEIVED");
    expect(p.outstandingByLine.get("l1")).toBe(0);
    expect(p.receivedByLine.get("l1")).toBe(12);
  });

  it("treats an empty PO as PLACED, never RECEIVED", () => {
    expect(receiptProgress([], []).status).toBe("PLACED");
  });
});
