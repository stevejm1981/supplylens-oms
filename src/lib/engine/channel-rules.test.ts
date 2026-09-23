import { describe, expect, it } from "vitest";
import { applyRules, buildChannelFeed, feedToCsv, type RuleStep } from "./channel-rules";

const veryRules: RuleStep[] = [
  { type: "oosThreshold", threshold: 5 },
  { type: "divide", by: 4, rounding: "floor" },
  { type: "blankWhenOos" },
];

const bufferRules: RuleStep[] = [
  { type: "subtract", amount: 20 },
  { type: "clamp", min: 0 },
  { type: "oosThreshold", threshold: 0 },
];

describe("applyRules, Very ruleset (≤5 OOS, ÷4, blank when OOS)", () => {
  it("marks ≤5 as OOS with blank quantity", () => {
    expect(applyRules(5, veryRules)).toEqual({ status: "OOS", feedQty: null });
    expect(applyRules(0, veryRules)).toEqual({ status: "OOS", feedQty: null });
  });

  it("divides in-stock quantities by 4, flooring", () => {
    expect(applyRules(6, veryRules)).toEqual({ status: "IS", feedQty: 1 });
    expect(applyRules(100, veryRules)).toEqual({ status: "IS", feedQty: 25 });
    expect(applyRules(103, veryRules)).toEqual({ status: "IS", feedQty: 25 });
  });

  it("threshold reads the RAW qty because it comes before the divide", () => {
    // 8 raw → IS (8 > 5) even though 8/4 = 2 would be ≤5
    expect(applyRules(8, veryRules)).toEqual({ status: "IS", feedQty: 2 });
  });
});

describe("applyRules, buffer ruleset (−20, clamp 0, OOS at 0)", () => {
  it("subtracts the buffer", () => {
    expect(applyRules(120, bufferRules)).toEqual({ status: "IS", feedQty: 100 });
  });
  it("clamps to zero and goes OOS", () => {
    expect(applyRules(12, bufferRules)).toEqual({ status: "OOS", feedQty: 0 });
  });
});

describe("safety rails", () => {
  it("never emits negative quantities even without a clamp step", () => {
    expect(applyRules(3, [{ type: "subtract", amount: 20 }]).feedQty).toBe(0);
  });
  it("empty pipeline passes through, floored and non-negative", () => {
    expect(applyRules(7, [])).toEqual({ status: "IS", feedQty: 7 });
  });
});

describe("feed building", () => {
  it("builds rows and CSV with blank cells for OOS", () => {
    const rows = buildChannelFeed(
      [
        { sku: "A", effectiveQty: 2 },
        { sku: "B", effectiveQty: 40 },
      ],
      veryRules,
    );
    expect(feedToCsv(rows)).toBe("SKU,Status,Quantity\nA,OOS,\nB,IS,10\n");
  });
});
