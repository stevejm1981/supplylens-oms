import { describe, expect, it } from "vitest";

import { computeAvgLandedCost } from "./average-cost";

describe("computeAvgLandedCost", () => {
  it("weights by quantity, keeping fractional pence", () => {
    // 100 @ 200p + 50 @ 260p = 33,000p over 150 = 220
    expect(
      computeAvgLandedCost([
        { quantity: 100, unitCostPence: 200 },
        { quantity: 50, unitCostPence: 260 },
      ]),
    ).toBe(220);
    // and fractional pence survive: 3 @ 100p + 1 @ 101p = 100.25
    expect(
      computeAvgLandedCost([
        { quantity: 3, unitCostPence: 100 },
        { quantity: 1, unitCostPence: 101 },
      ]),
    ).toBeCloseTo(100.25);
  });

  it("a late cost invoice re-prices the average upward", () => {
    const before = computeAvgLandedCost([{ quantity: 100, unitCostPence: 200 }]);
    const after = computeAvgLandedCost([{ quantity: 100, unitCostPence: 236.08 }]);
    expect(after!).toBeGreaterThan(before!);
  });

  it("ignores empty tranches and returns null with no stock", () => {
    expect(computeAvgLandedCost([])).toBeNull();
    expect(computeAvgLandedCost([{ quantity: 0, unitCostPence: 500 }])).toBeNull();
    expect(
      computeAvgLandedCost([
        { quantity: 0, unitCostPence: 999 },
        { quantity: 10, unitCostPence: 100 },
      ]),
    ).toBe(100);
  });
});
