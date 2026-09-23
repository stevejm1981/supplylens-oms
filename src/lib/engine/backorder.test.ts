import { describe, expect, it } from "vitest";

import { computeShortfall, type ProductRequirement } from "./backorder";

const req = (productId: string, outstandingBase: number): ProductRequirement => ({
  productId,
  sku: productId.toUpperCase(),
  supplierId: "sup1",
  supplierName: "Supplier One",
  outstandingBase,
});

describe("computeShortfall", () => {
  it("is empty while availability is non-negative, the company can supply everyone", () => {
    expect(computeShortfall([req("a", 50)], new Map([["a", 0]]))).toEqual([]);
    expect(computeShortfall([req("a", 50)], new Map([["a", 120]]))).toEqual([]);
  });

  it("caps the shortfall at this order's own need", () => {
    // company oversold by 30, but this order only wants 20 more
    const lines = computeShortfall([req("a", 20)], new Map([["a", -30]]));
    expect(lines[0].shortfall).toBe(20);
  });

  it("never covers more than the company-wide oversell", () => {
    // oversold by 30 with this order wanting 50, others hold the rest of the stock claim
    const lines = computeShortfall([req("a", 50)], new Map([["a", -30]]));
    expect(lines[0].shortfall).toBe(30);
  });

  it("subtracts cover already raised so re-clicking never double-buys", () => {
    const covered = new Map([["a", 30]]);
    expect(computeShortfall([req("a", 50)], new Map([["a", -30]]), covered)).toEqual([]);
    const partial = computeShortfall([req("a", 50)], new Map([["a", -30]]), new Map([["a", 10]]));
    expect(partial[0].shortfall).toBe(20);
  });

  it("ignores fulfilled lines and unknown products default to 0 available", () => {
    expect(computeShortfall([req("a", 0)], new Map())).toEqual([]);
    // unknown product with demand → available 0 → not negative → no shortfall
    expect(computeShortfall([req("ghost", 5)], new Map())).toEqual([]);
  });
});
