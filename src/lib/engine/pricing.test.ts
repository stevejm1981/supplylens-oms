import { describe, expect, it } from "vitest";

import { LOW_STOCK_THRESHOLD, resolveUnitPrice, stockBand } from "./pricing";

describe("resolveUnitPrice", () => {
  it("customer list price wins over the standard price", () => {
    expect(resolveUnitPrice({ customerPricePence: 549, sellPricePence: 799 })).toBe(549);
  });

  it("falls back to the sell price when no list price exists", () => {
    expect(resolveUnitPrice({ customerPricePence: null, sellPricePence: 799 })).toBe(799);
    expect(resolveUnitPrice({ sellPricePence: 799 })).toBe(799);
  });

  it("multiplies by the pack factor, per ordered unit", () => {
    expect(
      resolveUnitPrice({ customerPricePence: 549, sellPricePence: 799, unitsPerUom: 6 }),
    ).toBe(3294);
    expect(resolveUnitPrice({ sellPricePence: 799, unitsPerUom: 6 })).toBe(4794);
  });

  it("a zero list price is honoured (free line), negatives are not", () => {
    expect(resolveUnitPrice({ customerPricePence: 0, sellPricePence: 799 })).toBe(0);
    expect(resolveUnitPrice({ customerPricePence: -5, sellPricePence: 799 })).toBe(799);
  });
});

describe("stockBand", () => {
  it("bands availability without revealing numbers", () => {
    expect(stockBand(0)).toBe("OUT");
    expect(stockBand(-3)).toBe("OUT");
    expect(stockBand(LOW_STOCK_THRESHOLD - 1)).toBe("LOW");
    expect(stockBand(LOW_STOCK_THRESHOLD)).toBe("IN");
    expect(stockBand(500)).toBe("IN");
  });
});
