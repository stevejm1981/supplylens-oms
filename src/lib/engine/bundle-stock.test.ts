import { describe, expect, it } from "vitest";

import { bundleAvailability, computeEffectiveStock } from "./bundle-stock";

const stock = new Map([
  ["firepit", 10],
  ["tongs", 25],
  ["charcoal", 9],
]);

describe("bundleAvailability", () => {
  it("is the min over components of floor(stock / qtyPerBundle)", () => {
    // firepit×1 → 10, tongs×1 → 25, charcoal×2 → floor(9/2)=4 ← constraint
    expect(
      bundleAvailability(
        [
          { componentId: "firepit", quantity: 1 },
          { componentId: "tongs", quantity: 1 },
          { componentId: "charcoal", quantity: 2 },
        ],
        stock,
      ),
    ).toBe(4);
  });

  it("a missing or zero-stock component makes the bundle unbuildable", () => {
    expect(bundleAvailability([{ componentId: "ghost", quantity: 1 }], stock)).toBe(0);
  });

  it("an empty BOM or non-positive quantity yields 0, never Infinity", () => {
    expect(bundleAvailability([], stock)).toBe(0);
    expect(bundleAvailability([{ componentId: "tongs", quantity: 0 }], stock)).toBe(0);
  });
});

describe("computeEffectiveStock", () => {
  it("passes physical stock through for STANDARD and derives bundles", () => {
    const result = computeEffectiveStock(
      [
        { id: "tongs", type: "STANDARD" },
        { id: "bdl", type: "BUNDLE" },
      ],
      [{ bundleId: "bdl", components: [{ componentId: "charcoal", quantity: 2 }] }],
      stock,
    );
    expect(result.get("tongs")).toBe(25);
    expect(result.get("bdl")).toBe(4);
  });

  it("two bundles sharing a component both count it (documented virtual-bundle behaviour)", () => {
    const result = computeEffectiveStock(
      [
        { id: "a", type: "BUNDLE" },
        { id: "b", type: "BUNDLE" },
      ],
      [
        { bundleId: "a", components: [{ componentId: "tongs", quantity: 1 }] },
        { bundleId: "b", components: [{ componentId: "tongs", quantity: 1 }] },
      ],
      stock,
    );
    expect(result.get("a")).toBe(25);
    expect(result.get("b")).toBe(25);
  });
});
