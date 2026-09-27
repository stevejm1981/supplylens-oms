import { describe, expect, it } from "vitest";
import {
  accrualDelta,
  allocateConsignment,
  carriageStatus,
  effectiveCarriagePence,
  matchJournal,
} from "./carriage";

describe("carriageStatus", () => {
  it("is NONE with nothing recorded", () => {
    expect(carriageStatus(null, 0)).toBe("NONE");
    expect(carriageStatus(0, 0)).toBe("NONE");
  });
  it("is ACCRUED with an expected cost and no invoice", () => {
    expect(carriageStatus(4500, 0)).toBe("ACCRUED");
  });
  it("is INVOICED once any allocation exists, accrued or not", () => {
    expect(carriageStatus(4500, 5100)).toBe("INVOICED");
    expect(carriageStatus(null, 5100)).toBe("INVOICED");
  });
});

describe("effectiveCarriagePence", () => {
  it("uses the actual once invoiced, else the accrual, else zero", () => {
    expect(effectiveCarriagePence(4500, 5100)).toBe(5100);
    expect(effectiveCarriagePence(4500, 0)).toBe(4500);
    expect(effectiveCarriagePence(null, 0)).toBe(0);
  });
});

describe("matchJournal", () => {
  it("books only the overrun when actual exceeds the accrual", () => {
    expect(matchJournal(4500, 5100)).toEqual({ amountPence: 600, direction: "cost" });
  });
  it("reverses the surplus when the carrier charged less", () => {
    expect(matchJournal(4500, 4000)).toEqual({ amountPence: 500, direction: "reversal" });
  });
  it("books the full actual when nothing was accrued", () => {
    expect(matchJournal(null, 3800)).toEqual({ amountPence: 3800, direction: "cost" });
  });
  it("writes nothing on an exact match", () => {
    expect(matchJournal(4500, 4500)).toBeNull();
  });
});

describe("accrualDelta", () => {
  it("tops up when the expectation rises", () => {
    expect(accrualDelta(4000, 4500)).toEqual({ amountPence: 500, direction: "cost" });
  });
  it("releases when the expectation falls or clears", () => {
    expect(accrualDelta(4500, 4000)).toEqual({ amountPence: 500, direction: "reversal" });
    expect(accrualDelta(4500, null)).toEqual({ amountPence: 4500, direction: "reversal" });
  });
  it("accrues in full from nothing, and no-ops on no change", () => {
    expect(accrualDelta(null, 4500)).toEqual({ amountPence: 4500, direction: "cost" });
    expect(accrualDelta(4500, 4500)).toBeNull();
    expect(accrualDelta(null, null)).toBeNull();
  });
});

describe("allocateConsignment", () => {
  const despatches = [
    { despatchId: "a", netValuePence: 60000, weightGrams: 10000 },
    { despatchId: "b", netValuePence: 30000, weightGrams: 30000 },
  ];
  it("splits by value, penny-exact", () => {
    const { results } = allocateConsignment(9600, "VALUE", despatches);
    expect(results.map((r) => [r.lineId, r.amountPence])).toEqual([
      ["a", 6400],
      ["b", 3200],
    ]);
    expect(results.reduce((s, r) => s + r.amountPence, 0)).toBe(9600);
  });
  it("splits by weight", () => {
    const { results } = allocateConsignment(9600, "WEIGHT", despatches);
    expect(results.map((r) => [r.lineId, r.amountPence])).toEqual([
      ["a", 2400],
      ["b", 7200],
    ]);
  });
  it("splits equally under QUANTITY (one consignment each)", () => {
    const { results } = allocateConsignment(9601, "QUANTITY", despatches);
    expect(results.reduce((s, r) => s + r.amountPence, 0)).toBe(9601);
    expect(Math.abs(results[0].amountPence - results[1].amountPence)).toBeLessThanOrEqual(1);
  });
});
