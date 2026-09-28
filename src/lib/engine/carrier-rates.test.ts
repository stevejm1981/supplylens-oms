import { describe, expect, it } from "vitest";

import { postcodeArea, rateFor, zoneFor, type RateCard } from "./carrier-rates";

const card: RateCard = {
  carrier: "Stillers",
  name: "Stillers pallet 2026",
  basis: "PALLET",
  zones: [
    {
      name: "North East",
      postcodeAreas: ["NE", "SR", "DH"],
      perExtraUnitPence: 3500,
      breaks: [
        { upTo: 1, pricePence: 4500 },
        { upTo: 3, pricePence: 9900 },
        { upTo: 6, pricePence: 16500 },
      ],
    },
    {
      name: "Scotland",
      postcodeAreas: ["G", "EH"],
      perExtraUnitPence: null,
      breaks: [{ upTo: 2, pricePence: 12000 }],
    },
  ],
};

describe("postcodeArea", () => {
  it("takes the leading letters of the outward code", () => {
    expect(postcodeArea("BS11 8DD")).toBe("BS");
    expect(postcodeArea("m17 1wa")).toBe("M");
    expect(postcodeArea("EC1N 2HT")).toBe("EC");
  });
  it("rejects rubbish", () => {
    expect(postcodeArea("")).toBeNull();
    expect(postcodeArea(null)).toBeNull();
    expect(postcodeArea("12345")).toBeNull();
  });
});

describe("zoneFor / rateFor", () => {
  it("matches the zone by area, case-insensitively", () => {
    expect(zoneFor(card, "NE6 2AB")?.name).toBe("North East");
    expect(zoneFor(card, "g75 0qh")?.name).toBe("Scotland");
    expect(zoneFor(card, "BS11 8DD")).toBeNull();
  });

  it("prices by the smallest covering break", () => {
    expect(rateFor(card, "NE6 2AB", 1)).toEqual({ zone: "North East", pricePence: 4500 });
    expect(rateFor(card, "NE6 2AB", 2)).toEqual({ zone: "North East", pricePence: 9900 });
    expect(rateFor(card, "NE6 2AB", 6)).toEqual({ zone: "North East", pricePence: 16500 });
  });

  it("extends beyond the last break at the per-extra rate", () => {
    expect(rateFor(card, "SR1 1AA", 8)).toEqual({
      zone: "North East",
      pricePence: 16500 + 2 * 3500,
    });
  });

  it("is unrateable beyond the last break without a per-extra rate", () => {
    expect(rateFor(card, "G75 0QH", 2)).toEqual({ zone: "Scotland", pricePence: 12000 });
    expect(rateFor(card, "G75 0QH", 3)).toBeNull();
  });

  it("is unrateable for unknown areas or non-positive units", () => {
    expect(rateFor(card, "BS11 8DD", 1)).toBeNull();
    expect(rateFor(card, "NE6 2AB", 0)).toBeNull();
  });
});
