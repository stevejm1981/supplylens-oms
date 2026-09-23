// The accounting outbox. Every stock event with a value consequence writes a
// balanced journal here (in the same transaction as the stock move). An
// accounting integration drains it: GET ?status=PENDING → post each journal
// to Xero/QuickBooks → POST /{reference}/posted to acknowledge.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const since = parseUpdatedSince(request);
  const journals = await db.stockJournal.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    orderBy: { reference: "asc" },
    include: { lines: true },
  });
  return NextResponse.json({
    items: journals.map((j) => ({
      reference: j.reference,
      updatedAt: j.updatedAt,
      createdAt: j.createdAt,
      type: j.type,
      sourceRef: j.sourceRef,
      memo: j.memo,
      totalPence: j.totalPence,
      status: j.status,
      postedAt: j.postedAt,
      externalRef: j.externalRef,
      lines: j.lines.map((l) => ({
        account: l.account,
        debitPence: l.debitPence,
        creditPence: l.creditPence,
        description: l.description,
      })),
    })),
  });
}
