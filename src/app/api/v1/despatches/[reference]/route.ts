// PATCH a despatch: set or correct expected carriage after confirmation.
// This is how a rate that arrives later (a 3PL portal, a rate lookup)
// lands on an already-confirmed shipment; the accrual DELTA journals
// automatically, and the change is refused once a carrier invoice has
// matched (corrections then belong on the invoice).

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { setExpectedCarriage } from "@/app/(app)/sales-orders/actions";
import { requireApiKey } from "../../auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;

  let body: { expectedCarriagePence?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }
  if (!("expectedCarriagePence" in body)) {
    return NextResponse.json(
      { ok: false, error: "expectedCarriagePence is required (integer pence, null clears)" },
      { status: 422 },
    );
  }
  const value = body.expectedCarriagePence;
  if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0)) {
    return NextResponse.json(
      { ok: false, error: "expectedCarriagePence must be integer pence >= 0, or null" },
      { status: 422 },
    );
  }

  const despatch = await db.despatch.findUnique({
    where: { reference: reference.toUpperCase() },
    select: { id: true },
  });
  if (!despatch) {
    return NextResponse.json({ ok: false, error: "Unknown despatch" }, { status: 404 });
  }
  const result = await setExpectedCarriage(despatch.id, value ?? null);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  const updated = await db.despatch.findUniqueOrThrow({
    where: { id: despatch.id },
    select: { reference: true, expectedCarriagePence: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, ...updated });
}
