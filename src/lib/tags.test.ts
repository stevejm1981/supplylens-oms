import { describe, expect, it } from "vitest";
import { normalizeTags } from "./tags";

describe("normalizeTags", () => {
  it("trims, drops empties, and keeps order", () => {
    expect(normalizeTags(["  gift-wrap ", "", "priority", "   "])).toEqual([
      "gift-wrap",
      "priority",
    ]);
  });

  it("dedupes case-insensitively, keeping the first spelling", () => {
    expect(normalizeTags(["Prime", "prime", "PRIME", "fragile"])).toEqual(["Prime", "fragile"]);
  });

  it("accepts a comma-separated string (form input)", () => {
    expect(normalizeTags("gift-wrap, priority,,B2B ")).toEqual(["gift-wrap", "priority", "B2B"]);
  });

  it("ignores non-strings and non-arrays entirely", () => {
    expect(normalizeTags([1, null, "ok", {}])).toEqual(["ok"]);
    expect(normalizeTags(42)).toEqual([]);
    expect(normalizeTags(undefined)).toEqual([]);
  });

  it("clips long tags and caps the count at 20", () => {
    const long = "x".repeat(80);
    expect(normalizeTags([long])[0]).toHaveLength(40);
    expect(normalizeTags(Array.from({ length: 30 }, (_, i) => `t${i}`))).toHaveLength(20);
  });
});
