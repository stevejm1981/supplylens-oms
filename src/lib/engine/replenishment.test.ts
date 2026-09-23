import { describe, expect, it } from "vitest";

import {
  assessReplenishment,
  DEFAULT_LEAD_TIME_DAYS,
  ORDER_CYCLE_DAYS,
  SAFETY_STOCK_DAYS,
} from "./replenishment";

describe("assessReplenishment", () => {
  it("computes velocity, cover and thresholds", () => {
    // 56 units over 28 days = 2/day; lead 30 → ROP = 2×44 = 88, up-to = 2×74 = 148
    const r = assessReplenishment({
      despatchedInWindow: 56,
      windowDays: 28,
      available: 200,
      onOrder: 0,
      leadTimeDays: 30,
    });
    expect(r.velocityPerDay).toBe(2);
    expect(r.daysOfCover).toBe(100);
    expect(r.reorderPointUnits).toBe(88);
    expect(r.orderUpToUnits).toBe(148);
    expect(r.status).toBe("OK");
    expect(r.suggestedOrderQty).toBe(0);
  });

  it("flags REORDER when position falls to the reorder point and tops up to the order-up-to level", () => {
    const r = assessReplenishment({
      despatchedInWindow: 56,
      windowDays: 28,
      available: 50,
      onOrder: 20, // position 70 ≤ ROP 88
      leadTimeDays: 30,
    });
    expect(r.status).toBe("REORDER");
    expect(r.suggestedOrderQty).toBe(148 - 70);
  });

  it("counts inbound stock before suggesting", () => {
    const r = assessReplenishment({
      despatchedInWindow: 56,
      windowDays: 28,
      available: 50,
      onOrder: 200, // position 250, well covered
      leadTimeDays: 30,
    });
    expect(r.status).toBe("OK");
    expect(r.suggestedOrderQty).toBe(0);
    expect(r.daysOfCoverInbound).toBe(125);
  });

  it("flags OUT when nothing is available but sales continue", () => {
    const r = assessReplenishment({
      despatchedInWindow: 28,
      windowDays: 28,
      available: 0,
      onOrder: 10,
      leadTimeDays: 10,
    });
    expect(r.status).toBe("OUT");
    expect(r.daysOfCover).toBe(0);
    expect(r.suggestedOrderQty).toBeGreaterThan(0);
  });

  it("flags WATCH inside a week of the reorder point", () => {
    // velocity 2/day, ROP 88, position 95 is within 88 + 14
    const r = assessReplenishment({
      despatchedInWindow: 56,
      windowDays: 28,
      available: 95,
      onOrder: 0,
      leadTimeDays: 30,
    });
    expect(r.status).toBe("WATCH");
  });

  it("returns NO_SALES with null cover when the window is quiet", () => {
    const r = assessReplenishment({
      despatchedInWindow: 0,
      windowDays: 28,
      available: 40,
      onOrder: 0,
      leadTimeDays: null,
    });
    expect(r.status).toBe("NO_SALES");
    expect(r.daysOfCover).toBeNull();
    expect(r.suggestedOrderQty).toBe(0);
    expect(r.leadTimeDays).toBe(DEFAULT_LEAD_TIME_DAYS);
  });

  it("applies the default lead time when the supplier has none", () => {
    const r = assessReplenishment({
      despatchedInWindow: 28,
      windowDays: 28,
      available: 5,
      onOrder: 0,
      leadTimeDays: null,
    });
    expect(r.reorderPointUnits).toBe(DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS);
    expect(r.orderUpToUnits).toBe(
      DEFAULT_LEAD_TIME_DAYS + SAFETY_STOCK_DAYS + ORDER_CYCLE_DAYS,
    );
  });

  it("never suggests negative quantities", () => {
    const r = assessReplenishment({
      despatchedInWindow: 1,
      windowDays: 28,
      available: 1,
      onOrder: 10_000,
      leadTimeDays: 30,
    });
    expect(r.suggestedOrderQty).toBe(0);
  });
});
