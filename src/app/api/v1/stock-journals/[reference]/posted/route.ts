// Acknowledge a journal as posted to the accounting system. Idempotent:
// re-acknowledging returns duplicate rather than an error, so a flow can
// safely retry.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiKey } from "../../../auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;

  let payload: { externalRef?: string };
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const journal = await db.stockJournal.findUnique({
    where: { reference: reference.toUpperCase() },
  });
  if (!journal) {
    return NextResponse.json({ ok: false, error: "Journal not found" }, { status: 404 });
  }
  if (journal.status === "POSTED") {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      reference: journal.reference,
      externalRef: journal.externalRef,
    });
  }
  const updated = await db.stockJournal.update({
    where: { id: journal.id },
    data: {
      status: "POSTED",
      postedAt: new Date(),
      externalRef: payload.externalRef?.trim() || null,
    },
  });
  return NextResponse.json({
    ok: true,
    duplicate: false,
    reference: updated.reference,
    status: "POSTED",
    externalRef: updated.externalRef,
  });
}
