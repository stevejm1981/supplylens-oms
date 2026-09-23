import { describe, expect, it } from "vitest";

import {
  effectiveUnitPricePence,
  fillRates,
  formatFill,
  lineNetPence,
  orderNetPence,
  orderTotalsPence,
} from "./sales";

describe("lineNetPence", () => {
  it("is qty × price with discount applied, rounded to integer pence", () => {
    expect(lineNetPence({ quantity: 3, unitPricePence: 599 })).toBe(1797);
    expect(lineNetPence({ quantity: 10, unitPricePence: 599, discountPct: 5 })).toBe(5691);
    // 7 × 333 × 0.9 = 2097.9 → rounds, never truncates
    expect(lineNetPence({ quantity: 7, unitPricePence: 333, discountPct: 10 })).toBe(2098);
  });

  it("effective unit price keeps fractional pence for display", () => {
    expect(effectiveUnitPricePence({ quantity: 1, unitPricePence: 599, discountPct: 5 })).toBeCloseTo(569.05);
  });
});

describe("orderTotalsPence (Xero-style tax treatment)", () => {
  const lines = [{ quantity: 10, unitPricePence: 1000 }]; // £100 entered

  it("EXCLUSIVE adds 20% VAT on top", () => {
    const t = orderTotalsPence(lines, 0, "EXCLUSIVE");
    expect(t).toEqual({ netPence: 10000, vatPence: 2000, grossPence: 12000 });
  });

  it("INCLUSIVE extracts VAT from the entered amounts, penny-exactly", () => {
    const t = orderTotalsPence(lines, 0, "INCLUSIVE");
    expect(t.grossPence).toBe(10000);
    expect(t.netPence).toBe(8333); // 10000 / 1.2 rounded
    expect(t.vatPence).toBe(1667);
    expect(t.netPence + t.vatPence).toBe(t.grossPence); // never a penny adrift
  });

  it("NONE charges no VAT", () => {
    expect(orderTotalsPence(lines, 0, "NONE")).toEqual({
      netPence: 10000,
      vatPence: 0,
      grossPence: 10000,
    });
  });

  it("shipping joins the taxable amount", () => {
    const t = orderTotalsPence(lines, 500, "EXCLUSIVE");
    expect(t.netPence).toBe(10500);
    expect(t.vatPence).toBe(2100);
  });

  it("orderNetPence returns the ex-VAT figure reporting uses", () => {
    expect(orderNetPence(lines, 0, "INCLUSIVE")).toBe(8333);
    expect(orderNetPence(lines, 0)).toBe(10000); // defaults EXCLUSIVE
  });
});

describe("fillRates (scoping-doc rules)", () => {
  it("reproduces the customer scoping-doc example: 100 → 80 → 75", () => {
    const fill = fillRates([{ originalQty: 100, quantity: 80, despatchedQty: 75 }]);
    expect(fill.confirmation).toBeCloseTo(0.8);
    expect(fill.dispatchOriginal).toBeCloseTo(0.75);
    expect(fill.dispatchConfirmed).toBeCloseTo(0.9375);
  });

  it("caps per line so overdelivery on one SKU cannot hide another's shortage", () => {
    const fill = fillRates([
      { originalQty: 10, quantity: 20, despatchedQty: 20 }, // over-confirmed
      { originalQty: 10, quantity: 0, despatchedQty: 0 }, // cancelled
    ]);
    // capped: min(20,10) + min(0,10) = 10 of 20 original
    expect(fill.confirmation).toBeCloseTo(0.5);
  });

  it("is quantity-weighted, never an average of line percentages", () => {
    const fill = fillRates([
      { originalQty: 100, quantity: 100, despatchedQty: 100 },
      { originalQty: 1, quantity: 0, despatchedQty: 0 },
    ]);
    // naive average of 100% and 0% would be 50%; weighted is 100/101
    expect(fill.dispatchOriginal).toBeCloseTo(100 / 101);
  });

  it("weights pack lines in base units so units are compatible", () => {
    const fill = fillRates([
      { originalQty: 10, quantity: 10, despatchedQty: 10, unitsPerUom: 6 }, // 60 ea shipped
      { originalQty: 60, quantity: 60, despatchedQty: 0 }, // 60 ea missed
    ]);
    expect(fill.dispatchOriginal).toBeCloseTo(0.5);
  });

  it("returns null (N/A) on zero denominators", () => {
    const fill = fillRates([]);
    expect(fill.confirmation).toBeNull();
    expect(formatFill(fill.confirmation)).toBe("N/A");
  });

  it("formats round percentages without decimals", () => {
    expect(formatFill(0.8)).toBe("80%");
    expect(formatFill(0.9375)).toBe("93.75%");
  });
});
