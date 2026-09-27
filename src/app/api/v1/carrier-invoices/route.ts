// Carrier invoices: the SupplyLens integration surface for "link our carrier
// invoices to the relevant SO numbers". POST one invoice with charge lines;
// each line resolves its despatches by tracking number, despatch reference,
// or sales-order reference (when the order has exactly one despatched
// shipment). Explicit per-despatch amounts, or a split method for
// consolidated consignments. Idempotent on the carrier's invoice reference.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  createCarrierInvoice,
  type NewCarrierInvoiceLine,
} from "@/app/(app)/carrier-invoices/actions";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const since = parseUpdatedSince(request);
  const invoices = await db.carrierInvoice.findMany({
    where: since ? { updatedAt: { gt: since } } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      lines: {
        include: {
          allocations: {
            include: {
              despatch: {
                select: {
                  reference: true,
                  trackingNumber: true,
                  expectedCarriagePence: true,
                  salesOrder: { select: { reference: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({
    items: invoices.map((inv) => ({
      reference: inv.reference,
      carrier: inv.carrier,
      invoiceDate: inv.invoiceDate,
      source: inv.source,
      notes: inv.notes,
      updatedAt: inv.updatedAt,
      totalPence: inv.lines.reduce((s, l) => s + l.amountPence, 0),
      lines: inv.lines.map((l) => ({
        description: l.description,
        consignmentRef: l.consignmentRef,
        amountPence: l.amountPence,
        allocations: l.allocations.map((a) => ({
          despatch: a.despatch.reference,
          order: a.despatch.salesOrder.reference,
          tracking: a.despatch.trackingNumber,
          amountPence: a.amountPence,
          expectedCarriagePence: a.despatch.expectedCarriagePence,
          variancePence:
            a.despatch.expectedCarriagePence != null
              ? a.amountPence - a.despatch.expectedCarriagePence
              : null,
        })),
      })),
    })),
  });
}

interface PayloadDespatchRef {
  tracking?: string;
  despatch?: string;
  order?: string;
  amountPence?: number;
}

interface PayloadLine {
  description?: string;
  consignmentRef?: string;
  amountPence: number;
  despatches: PayloadDespatchRef[];
  method?: "VALUE" | "WEIGHT" | "QUANTITY";
}

export async function POST(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;

  let payload: {
    reference?: string;
    carrier?: string;
    invoiceDate?: string;
    notes?: string;
    lines?: PayloadLine[];
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload.reference?.trim() || !payload.carrier?.trim()) {
    return NextResponse.json(
      { ok: false, error: "reference and carrier are required" },
      { status: 422 },
    );
  }
  const existing = await db.carrierInvoice.findUnique({
    where: { reference: payload.reference.trim() },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true, reference: existing.reference });
  }
  if (!Array.isArray(payload.lines) || payload.lines.length === 0) {
    return NextResponse.json({ ok: false, error: "lines is required" }, { status: 422 });
  }

  const lines: NewCarrierInvoiceLine[] = [];
  for (const [i, line] of payload.lines.entries()) {
    if (!Array.isArray(line.despatches) || line.despatches.length === 0) {
      return NextResponse.json(
        { ok: false, error: `lines[${i}]: despatches is required` },
        { status: 422 },
      );
    }
    const resolved: { despatchId: string; amountPence?: number }[] = [];
    for (const [j, ref] of line.despatches.entries()) {
      let despatchId: string | null = null;
      if (ref.tracking) {
        const d = await db.despatch.findFirst({
          where: { trackingNumber: ref.tracking, status: "DESPATCHED" },
        });
        despatchId = d?.id ?? null;
      } else if (ref.despatch) {
        const d = await db.despatch.findUnique({ where: { reference: ref.despatch.toUpperCase() } });
        despatchId = d?.id ?? null;
      } else if (ref.order) {
        const candidates = await db.despatch.findMany({
          where: {
            status: "DESPATCHED",
            salesOrder: { reference: ref.order.toUpperCase() },
          },
        });
        if (candidates.length > 1) {
          return NextResponse.json(
            {
              ok: false,
              error: `lines[${i}].despatches[${j}]: ${ref.order} has ${candidates.length} despatched shipments, reference the despatch or tracking number instead`,
            },
            { status: 422 },
          );
        }
        despatchId = candidates[0]?.id ?? null;
      }
      if (!despatchId) {
        return NextResponse.json(
          {
            ok: false,
            error: `lines[${i}].despatches[${j}]: no despatched shipment matches ${ref.tracking ?? ref.despatch ?? ref.order ?? "the reference"}`,
          },
          { status: 422 },
        );
      }
      resolved.push({ despatchId, amountPence: ref.amountPence });
    }
    const allExplicit = resolved.every((r) => Number.isInteger(r.amountPence));
    lines.push(
      allExplicit
        ? {
            description: line.description ?? null,
            consignmentRef: line.consignmentRef ?? null,
            amountPence: line.amountPence,
            allocations: resolved.map((r) => ({
              despatchId: r.despatchId,
              amountPence: r.amountPence!,
            })),
          }
        : {
            description: line.description ?? null,
            consignmentRef: line.consignmentRef ?? null,
            amountPence: line.amountPence,
            split: {
              despatchIds: resolved.map((r) => r.despatchId),
              method: line.method ?? "VALUE",
            },
          },
    );
  }

  const result = await createCarrierInvoice({
    reference: payload.reference,
    carrier: payload.carrier,
    invoiceDate: payload.invoiceDate ?? null,
    notes: payload.notes ?? null,
    source: "API",
    lines,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json(
    { ok: true, duplicate: false, reference: payload.reference.trim() },
    { status: 201 },
  );
}
