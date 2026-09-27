import { describe, expect, it } from "vitest";
import { channelHeadroom, getPlan, usageCharge, PLANS } from "./plans";

describe("plan catalogue", () => {
  it("effective per-order rates decline monotonically up the ladder", () => {
    const rates = PLANS.map((p) => p.monthlyPence / p.includedOrders);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThan(rates[i - 1]);
  });

  it("unknown plan codes fall back to Starter", () => {
    expect(getPlan("NOPE").code).toBe("STARTER");
  });
});

describe("usageCharge", () => {
  it("bills the base only within the included volume", () => {
    const c = usageCharge("STARTER", 800);
    expect(c).toMatchObject({ extraOrders: 0, overagePence: 0, totalPence: 24900 });
  });

  it("bills overage at the plan's extra-order rate", () => {
    const c = usageCharge("GROWTH", 3500);
    expect(c.extraOrders).toBe(500);
    expect(c.overagePence).toBe(500 * 15);
    expect(c.totalPence).toBe(44900 + 7500);
  });

  it("recommends the cheaper plan once overage crosses the cliff", () => {
    // Starter at 3,000 orders costs £649; Growth is £449.
    const c = usageCharge("STARTER", 3000);
    expect(c.totalPence).toBe(24900 + 2000 * 20);
    expect(c.betterPlan?.code).toBe("GROWTH");
  });

  it("recommends nothing when the current plan is already cheapest", () => {
    expect(usageCharge("GROWTH", 2000).betterPlan).toBeNull();
  });

  it("handles zero orders", () => {
    const c = usageCharge("PRO", 0);
    expect(c.totalPence).toBe(119900);
    expect(c.includedUsed).toBe(0);
  });
});

describe("channelHeadroom", () => {
  it("flags a breached cap and respects unlimited plans", () => {
    expect(channelHeadroom("STARTER", 4)).toEqual({ limit: 3, over: true });
    expect(channelHeadroom("STARTER", 3)).toEqual({ limit: 3, over: false });
    expect(channelHeadroom("PRO", 40)).toEqual({ limit: null, over: false });
  });
});
