// API auth: real per-integration tokens (generated on the Integrations page,
// SHA-256 at rest) plus the fixed demo key for local development and docs.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sha256Hex } from "@/lib/auth-crypto";

const DEMO_KEY = process.env.OMS_API_KEY ?? "demo-key-supplylens";

/** ?updatedSince=<ISO datetime>, the incremental-sync filter on list endpoints. */
export function parseUpdatedSince(request: Request): Date | null {
  const value = new URL(request.url).searchParams.get("updatedSince");
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function requireApiKey(request: Request): Promise<NextResponse | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return unauthorized();
  if (token === DEMO_KEY) return null;

  const record = await db.apiToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
  if (!record || record.revokedAt) return unauthorized();
  // Fire-and-forget usage stamp, never let telemetry slow a request down.
  db.apiToken
    .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return null;
}

function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Missing or invalid API key (Authorization: Bearer <token>)" },
    { status: 401 },
  );
}
