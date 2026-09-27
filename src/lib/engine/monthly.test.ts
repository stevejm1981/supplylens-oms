import { describe, expect, it } from "vitest";
import { lastMonths, monthKey, sumByMonth } from "./monthly";

const now = new Date("2026-09-27T12:00:00Z");

describe("lastMonths", () => {
  it("returns n months oldest first, ending at the current month", () => {
    const buckets = lastMonths(12, now);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].key).toBe("2025-10");
    expect(buckets[11].key).toBe("2026-09");
    expect(buckets[11].label).toBe("Sep 26");
  });

  it("wraps the year boundary correctly", () => {
    const buckets = lastMonths(3, new Date("2026-01-15"));
    expect(buckets.map((b) => b.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("sumByMonth", () => {
  const buckets = lastMonths(3, now); // Jul, Aug, Sep 2026

  it("sums into the right months and ignores out-of-window dates", () => {
    const totals = sumByMonth(buckets, [
      { date: new Date("2026-07-01"), amountPence: 100 },
      { date: new Date("2026-07-31T23:59:59"), amountPence: 50 },
      { date: new Date("2026-09-05"), amountPence: 200 },
      { date: new Date("2026-06-30"), amountPence: 999 }, // before window
      { date: new Date("2026-10-01"), amountPence: 999 }, // after window
    ]);
    expect(totals).toEqual([150, 0, 200]);
  });

  it("handles negatives (credits) and empty input", () => {
    expect(sumByMonth(buckets, [{ date: new Date("2026-08-10"), amountPence: -75 }])).toEqual([
      0, -75, 0,
    ]);
    expect(sumByMonth(buckets, [])).toEqual([0, 0, 0]);
  });
});

describe("monthKey", () => {
  it("zero-pads months", () => {
    expect(monthKey(new Date("2026-03-09"))).toBe("2026-03");
  });
});
