import { describe, expect, it } from "vitest";

import { parseCsv, toCsv } from "./csv";

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\r\n1,2,3\r\n")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields with commas, escaped quotes and newlines (addresses)", () => {
    const csv = 'code,address\r\nHARW,"Unit 4, ""The Yard""\nLeeds LS1 4DT"\r\n';
    expect(parseCsv(csv)).toEqual([
      ["code", "address"],
      ["HARW", 'Unit 4, "The Yard"\nLeeds LS1 4DT'],
    ]);
  });

  it("accepts bare LF line endings and strips an Excel BOM", () => {
    expect(parseCsv("﻿a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops fully-empty trailing rows Excel loves to add", () => {
    expect(parseCsv("a,b\r\n1,2\r\n,\r\n\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("toCsv", () => {
  it("escapes only what needs escaping", () => {
    expect(toCsv([["plain", "with,comma", 'with"quote', "with\nnewline"]])).toBe(
      'plain,"with,comma","with""quote","with\nnewline"\r\n',
    );
  });

  it("round-trips: parse(toCsv(x)) === x", () => {
    const rows = [
      ["sku", "name", "address"],
      ["GRD-TONGS-01", "BBQ Tongs, 40cm", 'Unit 4 "rear dock"\nNN4 7XD'],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
