import { describe, expect, it } from "vitest";
import {
  allocateInvoice,
  landedUnitCostPence,
  type AllocatableLine,
} from "./landed-cost";

const line = (
  lineId: string,
  quantity: number,
  unitCostPence: number,
  unitWeightGrams = 0,
): AllocatableLine => ({ lineId, quantity, unitCostPence, unitWeightGrams });

describe("allocateInvoice", () => {
  it("splits £100.00 across 3 equal-value lines with exact sum (3334/3333/3333)", () => {
    const { results, fallback } = allocateInvoice(10000, "VALUE", [
      line("a", 1, 500),
      line("b", 1, 500),
      line("c", 1, 500),
    ]);
    expect(fallback).toBe(false);
    expect(results.map((r) => r.amountPence)).toEqual([3334, 3333, 3333]);
    expect(results.reduce((s, r) => s + r.amountPence, 0)).toBe(10000);
  });

  it("allocates by VALUE proportionally", () => {
    const { results } = allocateInvoice(1000, "VALUE", [
      line("a", 10, 100), // basis 1000 (25%)
      line("b", 10, 300), // basis 3000 (75%)
    ]);
    expect(results[0].amountPence).toBe(250);
    expect(results[1].amountPence).toBe(750);
    expect(results[0].share).toBeCloseTo(0.25);
  });

  it("allocates by QUANTITY", () => {
    const { results } = allocateInvoice(900, "QUANTITY", [
      line("a", 1, 99999),
      line("b", 2, 1),
    ]);
    expect(results[0].amountPence).toBe(300);
    expect(results[1].amountPence).toBe(600);
  });

  it("allocates by WEIGHT", () => {
    const { results } = allocateInvoice(500, "WEIGHT", [
      line("a", 2, 0, 100), // 200g
      line("b", 1, 0, 800), // 800g
    ]);
    expect(results[0].amountPence).toBe(100);
    expect(results[1].amountPence).toBe(400);
  });

  it("falls back to equal split when total basis is zero, flagged", () => {
    const { results, fallback } = allocateInvoice(1001, "WEIGHT", [
      line("a", 1, 100, 0),
      line("b", 1, 100, 0),
      line("c", 1, 100, 0),
    ]);
    expect(fallback).toBe(true);
    expect(results.reduce((s, r) => s + r.amountPence, 0)).toBe(1001);
    // Equal split of 1001 across 3 → 334/334/333 (extra pence to earliest lines)
    expect(results.map((r) => r.amountPence)).toEqual([334, 334, 333]);
  });

  it("gives everything to a single line", () => {
    const { results } = allocateInvoice(4200, "VALUE", [line("only", 3, 100)]);
    expect(results[0].amountPence).toBe(4200);
  });

  it("is deterministic on ties (input order wins)", () => {
    const a = allocateInvoice(101, "QUANTITY", [line("x", 1, 0), line("y", 1, 0)]);
    const b = allocateInvoice(101, "QUANTITY", [line("x", 1, 0), line("y", 1, 0)]);
    expect(a.results).toEqual(b.results);
    expect(a.results.map((r) => r.amountPence)).toEqual([51, 50]);
  });

  it("survives awkward primes with exact sum", () => {
    const lines = [
      line("a", 7, 1013, 331),
      line("b", 13, 977, 173),
      line("c", 29, 499, 941),
      line("d", 3, 2003, 89),
    ];
    for (const method of ["VALUE", "QUANTITY", "WEIGHT"] as const) {
      const { results } = allocateInvoice(123457, method, lines);
      expect(results.reduce((s, r) => s + r.amountPence, 0)).toBe(123457);
      for (const r of results) expect(Number.isInteger(r.amountPence)).toBe(true);
    }
  });

  it("throws on zero lines", () => {
    expect(() => allocateInvoice(100, "VALUE", [])).toThrow();
  });
});

describe("landedUnitCostPence", () => {
  it("adds allocated cost per unit to the base unit cost", () => {
    expect(landedUnitCostPence(1000, 4, 202)).toBeCloseTo(1050.5);
  });
});
