import { describe, expect, it } from "vitest";

import { buildCost, completionDeltas } from "./production";

describe("buildCost", () => {
  it("finished unit cost = actual component value / actual produced", () => {
    // 25 hampers from: 25 blankets @ 1063.5p, 25 candles @ 310p, 25 boxes @ 92p
    const cost = buildCost(
      [
        { componentId: "blanket", actualQty: 25, unitCostPence: 1063.5 },
        { componentId: "candle", actualQty: 25, unitCostPence: 310 },
        { componentId: "box", actualQty: 25, unitCostPence: 92 },
      ],
      25,
    );
    expect(cost.totalValuePence).toBe(36638); // rounded once at the total
    expect(cost.unitCostPence).toBeCloseTo(1465.52, 2);
  });

  it("yield loss raises the unit cost, same spend over fewer units", () => {
    const plan = buildCost([{ componentId: "c", actualQty: 100, unitCostPence: 50 }], 100);
    const short = buildCost([{ componentId: "c", actualQty: 100, unitCostPence: 50 }], 90);
    expect(plan.unitCostPence).toBeCloseTo(50);
    expect(short.unitCostPence).toBeCloseTo(55.5556, 3);
    expect(short.totalValuePence).toBe(plan.totalValuePence); // spend unchanged
  });

  it("absorbs overhead (labour, machine time) into the finished cost", () => {
    // 100 units of 50p components + 20 pounds of labour = 70p per unit
    const cost = buildCost([{ componentId: "c", actualQty: 100, unitCostPence: 50 }], 100, 2000);
    expect(cost.componentValuePence).toBe(5000);
    expect(cost.overheadPence).toBe(2000);
    expect(cost.totalValuePence).toBe(7000);
    expect(cost.unitCostPence).toBeCloseTo(70);
    expect(() => buildCost([], 10, -1)).toThrow();
  });

  it("refuses a zero-yield build", () => {
    expect(() => buildCost([{ componentId: "c", actualQty: 1, unitCostPence: 100 }], 0)).toThrow();
  });
});

describe("completionDeltas", () => {
  it("overruns consume more, surpluses return, exact lines vanish", () => {
    const deltas = completionDeltas([
      { componentId: "a", plannedQty: 25, actualQty: 27 }, // broke two, used spares
      { componentId: "b", plannedQty: 25, actualQty: 24 }, // one left over
      { componentId: "c", plannedQty: 25, actualQty: 25 }, // exactly to plan
    ]);
    expect(deltas).toEqual([
      { componentId: "a", delta: 2 },
      { componentId: "b", delta: -1 },
    ]);
  });
});
