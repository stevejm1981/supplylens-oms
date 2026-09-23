// Pure credential primitives, no Next/DB imports so they unit-test cleanly.
// scrypt via Node built-ins: no password-hashing dependency to audit.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  let expected: Buffer;
  try {
    expected = Buffer.from(hash, "hex");
  } catch {
    return false;
  }
  const candidate = scryptSync(password, salt, 64);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * A machine credential: `oms_<40 hex>`. Only the hash is stored; the caller
 * shows the token once and keeps the prefix for display.
 */
export function generateApiToken(): { token: string; tokenHash: string; prefix: string } {
  const token = `oms_${randomBytes(20).toString("hex")}`;
  return { token, tokenHash: sha256Hex(token), prefix: `${token.slice(0, 12)}…` };
}
