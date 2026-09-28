import { describe, expect, it } from "vitest";

import {
  addressOneLine,
  asAddress,
  formatAddress,
  normalizeAddress,
  parseAddress,
  validateAddress,
} from "./address";

describe("normalizeAddress", () => {
  it("trims parts and drops empties", () => {
    expect(
      normalizeAddress({ line1: "  1 High St ", line2: "  ", city: "Leeds", postcode: "" }),
    ).toEqual({ line1: "1 High St", city: "Leeds" });
  });

  it("returns null when nothing remains", () => {
    expect(normalizeAddress({ line1: " ", city: "" })).toBeNull();
    expect(normalizeAddress(null)).toBeNull();
  });

  it("treats a country on its own as empty (forms default it)", () => {
    expect(normalizeAddress({ country: "United Kingdom" })).toBeNull();
  });
});

describe("validateAddress", () => {
  it("passes with the minimum: name or company, line1, city, postcode", () => {
    expect(
      validateAddress({ company: "Acme Ltd", line1: "1 High St", city: "Leeds", postcode: "LS1 1AA" }),
    ).toEqual([]);
    expect(
      validateAddress({ name: "Jo Smith", line1: "1 High St", city: "Leeds", postcode: "LS1 1AA" }),
    ).toEqual([]);
  });

  it("names every missing part", () => {
    expect(validateAddress({ line2: "Floor 2" })).toEqual([
      "name or company",
      "address line 1",
      "city",
      "postcode",
    ]);
    expect(validateAddress(null)).toHaveLength(4);
  });
});

describe("formatAddress", () => {
  const full = {
    name: "Goods In",
    company: "The Range DC 3",
    line1: "Avonmouth Way",
    city: "Bristol",
    province: "Avon",
    postcode: "BS11 8DD",
    country: "United Kingdom",
  };

  it("builds the block and omits the home country", () => {
    expect(formatAddress(full)).toBe(
      "Goods In\nThe Range DC 3\nAvonmouth Way\nBristol, Avon\nBS11 8DD",
    );
  });

  it("prints a foreign country", () => {
    expect(formatAddress({ ...full, country: "Ireland" })).toContain("Ireland");
  });

  it("is empty for null", () => {
    expect(formatAddress(null)).toBe("");
  });

  it("one-line variant joins with commas", () => {
    expect(addressOneLine({ line1: "1 High St", city: "Leeds", postcode: "LS1 1AA" })).toBe(
      "1 High St, Leeds, LS1 1AA",
    );
  });
});

describe("parseAddress (legacy free text)", () => {
  it("splits city + postcode off the last line", () => {
    expect(parseAddress("Unit 4, Meadow Business Park\nNorthampton NN4 7XD")).toEqual({
      line1: "Unit 4, Meadow Business Park",
      city: "Northampton",
      postcode: "NN4 7XD",
      country: "United Kingdom",
    });
  });

  it("handles a bare postcode line with the city above it", () => {
    expect(parseAddress("The Range DC 3\nAvonmouth Way\nBristol\nBS11 8DD")).toEqual({
      line1: "The Range DC 3",
      line2: "Avonmouth Way",
      city: "Bristol",
      postcode: "BS11 8DD",
      country: "United Kingdom",
    });
  });

  it("overflows extra street lines into line3", () => {
    const a = parseAddress("A\nB\nC\nD\nBristol BS1 4QD");
    expect(a).toMatchObject({ line1: "A", line2: "B", line3: "C, D", city: "Bristol" });
  });

  it("keeps a single line as line1 without inventing a city", () => {
    expect(parseAddress("14 Elm Grove")).toEqual({
      line1: "14 Elm Grove",
      country: "United Kingdom",
    });
  });

  it("strips a trailing country line before finding the postcode", () => {
    expect(parseAddress("Hilmore House\nGain Lane\nBradford BD3 7DL\nUnited Kingdom")).toEqual({
      line1: "Hilmore House",
      line2: "Gain Lane",
      city: "Bradford",
      postcode: "BD3 7DL",
      country: "United Kingdom",
    });
  });

  it("returns null for blank input", () => {
    expect(parseAddress("  \n ")).toBeNull();
    expect(parseAddress(null)).toBeNull();
  });
});

describe("asAddress", () => {
  it("reads a JSON column back and rejects non-objects", () => {
    expect(asAddress({ line1: "1 High St" })).toEqual({ line1: "1 High St" });
    expect(asAddress("1 High St")).toBeNull();
    expect(asAddress(["x"])).toBeNull();
    expect(asAddress(null)).toBeNull();
  });
});
