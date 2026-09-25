// Order intake, the EDI/marketplace sync surface.
// Everything resolves by the human-stable codes the UI already manages:
// customer.code, channel.code, customerLocation.code, product SKU.
// Idempotent per (channel, externalRef): EDI re-sends return the existing order.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { orderNetPence } from "@/lib/sales";
import { getSettings } from "@/lib/settings";
import { resolveUnitPrice } from "@/lib/engine/pricing";
import { createSalesOrder } from "@/app/(app)/sales-orders/actions";
import { parseUpdatedSince, requireApiKey } from "../auth";

export async function GET(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();
  const channel = url.searchParams.get("channel");
  const since = parseUpdatedSince(request);
  const orders = await db.salesOrder.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(channel ? { channel: { code: channel } } : {}),
      ...(since ? { updatedAt: { gt: since } } : {}),
    },
    orderBy: { reference: "asc" },
    include: {
      customer: { select: { code: true } },
      channel: { select: { code: true } },
      lines: { include: { despatchLines: { select: { despatchedQty: true } } } },
      invoice: { select: { number: true } },
    },
  });
  return NextResponse.json({
    items: orders.map((o) => {
      const ordered = o.lines.reduce((s, l) => s + l.quantity, 0);
      const despatched = o.lines.reduce(
        (s, l) => s + l.despatchLines.reduce((x, d) => x + d.despatchedQty, 0),
        0,
      );
      return {
        reference: o.reference,
        updatedAt: o.updatedAt,
        customer: o.customer.code,
        channel: o.channel?.code ?? null,
        externalRef: o.externalRef,
        status: o.status,
        isPreOrder: o.isPreOrder,
        fulfilment:
          despatched === 0 ? "UNFULFILLED" : despatched >= ordered ? "FULFILLED" : "PARTIAL",
        orderDate: o.orderDate,
        netPence: orderNetPence(o.lines, o.shippingPence, o.taxTreatment),
        invoice: o.invoice?.number ?? null,
      };
    }),
  });
}

interface IntakeLine {
  sku?: string; // one of sku / barcode is required; sku wins if both sent
  barcode?: string; // EAN/GTIN, the product's own, or an outer/case GTIN which also picks the unit
  uom?: string; // pack unit code ("PACK6"), omit for eaches; implied by an outer barcode
  quantity: number; // in the ordered unit (16 = 16 packs when the unit is a pack)
  unitPricePence?: number; // per ordered unit; OMIT to price from the customer's list (or sell price)
  discountPct?: number;
}

interface IntakePayload {
  customer: string; // customer code, e.g. "RANGE"
  channel?: string; // channel code, e.g. "mirakl-tesco"
  location?: string; // delivery location code, e.g. "AVONMOUTH-DC3"
  customerPoNumber?: string;
  externalRef?: string; // the channel's own order id, idempotency key
  taxTreatment?: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
  preOrder?: boolean;
  orderDate?: string;
  requiredDate?: string;
  shippingService?: string;
  shippingInstructions?: string;
  giftMessage?: string;
  shippingPence?: number;
  notes?: string;
  lines: IntakeLine[];
}

export async function POST(request: Request) {
  const denied = await requireApiKey(request);
  if (denied) return denied;

  let payload: IntakePayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }
  if (!payload.customer || !Array.isArray(payload.lines) || payload.lines.length === 0) {
    return NextResponse.json(
      { ok: false, error: "customer (code) and at least one line are required" },
      { status: 422 },
    );
  }

  // ── Resolve codes → records, collecting every failure for one clear reply ──
  const problems: string[] = [];

  const customer = await db.customer.findUnique({
    where: { code: payload.customer.toUpperCase() },
    include: { locations: true, prices: true },
  });
  if (!customer) problems.push(`unknown customer code "${payload.customer}"`);

  let channelId: string | null = null;
  if (payload.channel) {
    const channel = await db.channel.findUnique({ where: { code: payload.channel } });
    if (!channel) problems.push(`unknown channel code "${payload.channel}"`);
    channelId = channel?.id ?? null;
  }

  // Lines resolve by SKU or barcode, retailers usually only know the EAN.
  // GS1-style, a barcode is either the product's own (an each) or an outer/case
  // GTIN on one of its pack units, the outer barcode resolves product AND unit.
  const skus = payload.lines.map((l) => l.sku?.toUpperCase()).filter(Boolean) as string[];
  const barcodes = payload.lines
    .filter((l) => !l.sku && l.barcode)
    .map((l) => l.barcode!.trim());
  const [products, outerUoms] = await Promise.all([
    db.product.findMany({
      where: { OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }] },
      include: { uoms: true },
    }),
    db.productUom.findMany({
      where: { barcode: { in: barcodes } },
      include: { product: { include: { uoms: true } } },
    }),
  ]);
  const productBySku = new Map(products.map((p) => [p.sku, p]));
  const productByBarcode = new Map(
    products.filter((p) => p.barcode).map((p) => [p.barcode!, p]),
  );
  const uomByBarcode = new Map(outerUoms.map((u) => [u.barcode!, u]));

  type Resolved = {
    product: (typeof products)[number];
    uom: { code: string; unitsPerUom: number } | null;
  };
  const resolveLine = (line: IntakeLine): Resolved | undefined => {
    let product: (typeof products)[number] | undefined;
    let impliedUom: Resolved["uom"] = null;
    if (line.sku) {
      product = productBySku.get(line.sku.toUpperCase());
    } else if (line.barcode) {
      const code = line.barcode.trim();
      product = productByBarcode.get(code);
      if (!product) {
        const outer = uomByBarcode.get(code);
        if (outer) {
          product = { ...outer.product };
          impliedUom = { code: outer.code, unitsPerUom: outer.unitsPerUom };
        }
      }
    }
    if (!product) return undefined;
    if (line.uom) {
      const uom = product.uoms.find((u) => u.code === line.uom!.toUpperCase());
      if (!uom) return { product, uom: { code: "?", unitsPerUom: 0 } }; // flagged below
      return { product, uom: { code: uom.code, unitsPerUom: uom.unitsPerUom } };
    }
    return { product, uom: impliedUom };
  };
  for (const line of payload.lines) {
    const label = line.sku ?? line.barcode ?? "(no identifier)";
    const resolved = line.sku || line.barcode ? resolveLine(line) : undefined;
    if (!line.sku && !line.barcode) {
      problems.push("each line needs a sku or a barcode");
    } else if (!resolved) {
      problems.push(line.sku ? `unknown SKU "${line.sku}"` : `unknown barcode "${line.barcode}"`);
    } else if (resolved.uom?.code === "?") {
      problems.push(
        `unknown uom "${line.uom}" for ${resolved.product.sku} (configured: ${
          resolved.product.uoms.map((u) => u.code).join(", ") || "none"
        })`,
      );
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      problems.push(`invalid quantity for "${label}"`);
    }
    if (line.unitPricePence !== undefined && (!Number.isInteger(line.unitPricePence) || line.unitPricePence < 0)) {
      problems.push(`invalid unitPricePence for "${label}" (integer pence required)`);
    }
  }

  let location = null;
  if (customer) {
    if (payload.location) {
      location =
        customer.locations.find(
          (l) => l.code === payload.location!.toUpperCase().replace(/\s+/g, "-"),
        ) ?? null;
      if (!location) {
        problems.push(
          `unknown location code "${payload.location}" for customer ${customer.code}`,
        );
      }
    } else {
      location = customer.locations.find((l) => l.isDefault) ?? customer.locations[0] ?? null;
    }
    if (!customer.defaultSalesPersonId) {
      problems.push(`customer ${customer.code} has no default salesperson, set one first`);
    }
  }

  if (problems.length > 0) {
    return NextResponse.json({ ok: false, errors: problems }, { status: 422 });
  }

  // ── Idempotency: same channel + externalRef → return the existing order ───
  if (payload.externalRef) {
    const existing = await db.salesOrder.findFirst({
      where: { externalRef: payload.externalRef, channelId },
    });
    if (existing) {
      return NextResponse.json(
        { ok: true, duplicate: true, reference: existing.reference, id: existing.id },
        { status: 200 },
      );
    }
  }

  const warehouseId =
    customer!.defaultWarehouseId ??
    (await db.warehouse.findFirst({ where: { isDefault: true } }))?.id;
  if (!warehouseId) {
    return NextResponse.json(
      { ok: false, error: "No warehouse configured" },
      { status: 422 },
    );
  }

  const result = await createSalesOrder({
    customerId: customer!.id,
    salesPersonId: customer!.defaultSalesPersonId!,
    warehouseId,
    channelId,
    deliveryLocationId: location?.id ?? null,
    orderDate: payload.orderDate ?? null,
    requiredDate: payload.requiredDate ?? null,
    customerPoNumber: payload.customerPoNumber ?? null,
    externalRef: payload.externalRef ?? null,
    deliveryAddress: location?.address ?? customer!.deliveryAddress ?? null,
    deliveryContact: location?.contact ?? null,
    shippingService: payload.shippingService ?? null,
    shippingInstructions: payload.shippingInstructions ?? null,
    giftMessage: payload.giftMessage ?? null,
    shippingPence: payload.shippingPence ?? 0,
    taxTreatment: payload.taxTreatment ?? (await getSettings()).defaultTaxTreatment,
    isPreOrder: payload.preOrder ?? false,
    notes: payload.notes ?? null,
    lines: payload.lines.map((l) => {
      const { product, uom } = resolveLine(l)!;
      const listPrice = customer!.prices.find((p) => p.productId === product.id);
      return {
        productId: product.id,
        quantity: l.quantity,
        uomCode: uom?.code ?? null,
        unitsPerUom: uom?.unitsPerUom ?? 1,
        // Explicit price wins; otherwise the customer's list price, then the
        // standard sell price, times the pack factor.
        unitPricePence:
          l.unitPricePence ??
          resolveUnitPrice({
            customerPricePence: listPrice?.unitPricePence ?? null,
            sellPricePence: product.sellPricePence,
            unitsPerUom: uom?.unitsPerUom ?? 1,
          }),
        discountPct: l.discountPct ?? 0,
      };
    }),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  const created = await db.salesOrder.findUniqueOrThrow({ where: { id: result.id! } });
  return NextResponse.json(
    { ok: true, duplicate: false, reference: created.reference, id: created.id },
    { status: 201 },
  );
}
