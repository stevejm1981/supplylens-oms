import { describe, expect, it } from "vitest";

import { generateApiToken, generateToken, hashPassword, sha256Hex, verifyPassword } from "./auth-crypto";

describe("password hashing", () => {
  it("verifies the right password and rejects the wrong one", () => {
    const stored = hashPassword("correct horse battery staple");
    expect(verifyPassword("correct horse battery staple", stored)).toBe(true);
    expect(verifyPassword("Tr0ub4dor&3", stored)).toBe(false);
    expect(verifyPassword("", stored)).toBe(false);
  });

  it("salts: the same password hashes differently every time", () => {
    const a = hashPassword("same-password");
    const b = hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(verifyPassword("same-password", a)).toBe(true);
    expect(verifyPassword("same-password", b)).toBe(true);
  });

  it("rejects malformed stored values instead of throwing", () => {
    expect(verifyPassword("x", "")).toBe(false);
    expect(verifyPassword("x", "no-colon-here")).toBe(false);
    expect(verifyPassword("x", "salt:")).toBe(false);
  });
});

describe("generateToken", () => {
  it("produces 64 hex chars, unique per call", () => {
    const t = generateToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(generateToken()).not.toBe(t);
  });
});

describe("generateApiToken", () => {
  it("produces oms_-prefixed tokens whose hash matches sha256Hex", () => {
    const { token, tokenHash, prefix } = generateApiToken();
    expect(token).toMatch(/^oms_[0-9a-f]{40}$/);
    expect(tokenHash).toBe(sha256Hex(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(prefix).toBe(`${token.slice(0, 12)}…`);
    expect(prefix).not.toContain(token.slice(12)); // display never leaks the secret
  });

  it("sha256Hex is deterministic", () => {
    expect(sha256Hex("abc")).toBe(sha256Hex("abc"));
    expect(sha256Hex("abc")).not.toBe(sha256Hex("abd"));
  });
});
