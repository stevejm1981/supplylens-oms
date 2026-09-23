// Order readback (GET) and partial update (PATCH).
//
// PATCH is JSON Merge Patch in spirit: only the fields you send change,
// an explicit null clears a nullable field, everything omitted is retained,
// no get-modify-put-everything cycle. Lines merge by SKU (drafts only):
// patch qty/price/discount, quantity 0 short-cancels (line retained for
// fill-rate reporting), an unseen SKU adds. Quantity changes need a reason.

import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireApiKey } from "../../auth";
import { serializeOrder } from "../serialize";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;
  const body = await serializeOrder(reference);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }
  return NextResponse.json(body);
}

// Fields patchable while the order is not yet invoiced.
const OPEN_FIELDS = new Set([
  "customerPoNumber",
  "externalRef",
  "orderDate",
  "requiredDate",
  "shippingService",
  "shippingInstructions",
  "giftMessage",
  "notes",
  "deliveryAddress",
  "deliveryContact",
  "location",
  "channel",
  "shippingPence",
  "taxTreatment",
  "preOrder",
  "lines",
  "amendmentReason",
]);
// After invoicing only logistics/reference fields may change, nothing that
// moves money.
const INVOICED_FIELDS = new Set([
  "customerPoNumber",
  "requiredDate",
  "shippingService",
  "shippingInstructions",
  "giftMessage",
  "notes",
  "deliveryAddress",
  "deliveryContact",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const denied = await requireApiKey(request);
  if (denied) return denied;
  const { reference } = await params;

  let patch: Record<string, unknown>;
  try {
    patch = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be JSON" }, { status: 400 });
  }

  const order = await db.salesOrder.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      customer: { include: { locations: true } },
      lines: { include: { product: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  const allowed = order.status === "INVOICED" ? INVOICED_FIELDS : OPEN_FIELDS;
  const problems: string[] = [];
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) {
      problems.push(
        order.status === "INVOICED" && OPEN_FIELDS.has(key)
          ? `"${key}" cannot change after invoicing`
          : `unknown field "${key}"`,
      );
    }
  }
  if ("lines" in patch && order.status !== "DRAFT") {
    problems.push("lines can only be patched while the order is a draft");
  }

  const has = (key: string) => key in patch && allowed.has(key);
  const str = (key: string): string | null | undefined =>
    has(key) ? ((patch[key] as string | null)?.toString().trim() ?? null) : undefined;

  const data: Record<string, unknown> = {};
  for (const key of [
    "customerPoNumber",
    "externalRef",
    "shippingService",
    "shippingInstructions",
    "giftMessage",
    "notes",
    "deliveryAddress",
    "deliveryContact",
  ]) {
    const value = str(key);
    if (value !== undefined) data[key] = value || null;
  }
  for (const key of ["orderDate", "requiredDate"]) {
    if (has(key)) {
      const raw = patch[key];
      if (raw === null) data[key] = null;
      else {
        const date = new Date(raw as string);
        if (Number.isNaN(date.getTime())) problems.push(`invalid date for "${key}"`);
        else data[key] = date;
      }
    }
  }
  if (has("shippingPence")) {
    const v = patch.shippingPence;
    if (!Number.isInteger(v) || (v as number) < 0) problems.push("shippingPence must be integer pence ≥ 0");
    else data.shippingPence = v;
  }
  if (has("taxTreatment")) {
    const v = patch.taxTreatment;
    if (!["EXCLUSIVE", "INCLUSIVE", "NONE"].includes(v as string)) {
      problems.push("taxTreatment must be EXCLUSIVE | INCLUSIVE | NONE");
    } else data.taxTreatment = v;
  }
  if (has("preOrder")) {
    if (typeof patch.preOrder !== "boolean") problems.push("preOrder must be boolean");
    else data.isPreOrder = patch.preOrder;
  }
  if (has("channel")) {
    if (patch.channel === null) data.channelId = null;
    else {
      const channel = await db.channel.findUnique({ where: { code: patch.channel as string } });
      if (!channel) problems.push(`unknown channel code "${patch.channel}"`);
      else data.channelId = channel.id;
    }
  }
  if (has("location")) {
    if (patch.location === null) data.deliveryLocationId = null;
    else {
      const code = (patch.location as string).toUpperCase().replace(/\s+/g, "-");
      const location = order.customer.locations.find((l) => l.code === code);
      if (!location) {
        problems.push(`unknown location code "${patch.location}" for customer ${order.customer.code}`);
      } else {
        data.deliveryLocationId = location.id;
        // Re-snapshot unless the caller explicitly set address/contact too.
        if (!("deliveryAddress" in patch)) data.deliveryAddress = location.address;
        if (!("deliveryContact" in patch)) data.deliveryContact = location.contact;
      }
    }
  }

  // ── Line merge by SKU + unit (drafts only) ─────────────────────────────────
  // A barcode may be the product's own (each) or an outer/case GTIN, which
  // resolves the pack unit too. Same SKU in different units = different lines.
  interface LinePatch {
    sku?: string; // or match by barcode, sku wins if both sent
    barcode?: string;
    uom?: string; // pack unit code; implied by an outer barcode
    quantity?: number;
    unitPricePence?: number;
    discountPct?: number;
  }
  const lineOps: { op: "update" | "create"; lineId?: string; data?: Record<string, unknown> }[] = [];
  const amendments: { sku: string; field: string; oldValue: string; newValue: string }[] = [];
  const amendmentReason =
    typeof patch.amendmentReason === "string" ? patch.amendmentReason.trim() : "";
  if (has("lines") && order.status === "DRAFT") {
    const linePatches = patch.lines as LinePatch[];
    if (!Array.isArray(linePatches)) problems.push("lines must be an array");
    else {
      for (const lp of linePatches) {
        let sku = lp.sku?.toUpperCase();
        let uomCode = lp.uom?.toUpperCase(); // undefined = not specified
        if (!sku && lp.barcode) {
          const code = lp.barcode.trim();
          const byBarcode = await db.product.findUnique({ where: { barcode: code } });
          if (byBarcode) sku = byBarcode.sku;
          else {
            const outer = await db.productUom.findUnique({
              where: { barcode: code },
              include: { product: { select: { sku: true } } },
            });
            if (!outer) {
              problems.push(`unknown barcode "${lp.barcode}"`);
              continue;
            }
            sku = outer.product.sku;
            uomCode = uomCode ?? outer.code;
          }
        }
        if (!sku) {
          problems.push("each line patch needs a sku or a barcode");
          continue;
        }
        const candidates = order.lines.filter((l) => l.product.sku === sku);
        const existing =
          uomCode !== undefined
            ? candidates.find((l) => l.uomCode === uomCode)
            : (candidates.find((l) => !l.uomCode) ?? candidates[0]);
        if (lp.quantity !== undefined && (!Number.isInteger(lp.quantity) || lp.quantity < 0)) {
          problems.push(`invalid quantity for "${sku}"`);
          continue;
        }
        if (existing) {
          // Quantity 0 short-cancels the line but RETAINS it, original stays
          // visible so fill rates can't hide the shortfall.
          const update: Record<string, unknown> = {};
          if (lp.quantity !== undefined && lp.quantity !== existing.quantity) {
            update.quantity = lp.quantity;
            amendments.push({
              sku: sku!,
              field: lp.quantity === 0 ? "line-cancelled" : "quantity",
              oldValue: String(existing.quantity),
              newValue: String(lp.quantity),
            });
          }
          if (lp.unitPricePence !== undefined) {
            if (!Number.isInteger(lp.unitPricePence) || lp.unitPricePence < 0)
              problems.push(`invalid unitPricePence for "${sku}"`);
            else update.unitPricePence = lp.unitPricePence;
          }
          if (lp.discountPct !== undefined) {
            if (typeof lp.discountPct !== "number" || lp.discountPct < 0 || lp.discountPct > 100)
              problems.push(`invalid discountPct for "${sku}"`);
            else update.discountPct = lp.discountPct;
          }
          if (Object.keys(update).length > 0) lineOps.push({ op: "update", lineId: existing.id, data: update });
        } else {
          const product = await db.product.findUnique({
            where: { sku },
            include: { uoms: true },
          });
          if (!product) problems.push(`unknown SKU "${sku}"`);
          else if (!lp.quantity || !Number.isInteger(lp.unitPricePence ?? NaN)) {
            problems.push(`new line "${sku}" needs quantity and unitPricePence`);
          } else {
            const uom = uomCode ? product.uoms.find((u) => u.code === uomCode) : null;
            if (uomCode && !uom) {
              problems.push(`unknown uom "${uomCode}" for ${sku}`);
              continue;
            }
            lineOps.push({
              op: "create",
              data: {
                orderId: order.id,
                productId: product.id,
                originalQty: lp.quantity,
                quantity: lp.quantity,
                uomCode: uom?.code ?? null,
                unitsPerUom: uom?.unitsPerUom ?? 1,
                unitPricePence: lp.unitPricePence,
                discountPct: lp.discountPct ?? 0,
              },
            });
            amendments.push({
              sku: sku!,
              field: "line-added",
              oldValue: "0",
              newValue: String(lp.quantity),
            });
          }
        }
      }
      if (amendments.length > 0 && !amendmentReason) {
        problems.push("amendmentReason is required when line quantities change");
      }
    }
  }

  if (problems.length > 0) {
    return NextResponse.json({ ok: false, errors: problems }, { status: 422 });
  }
  if (Object.keys(data).length === 0 && lineOps.length === 0) {
    return NextResponse.json({ ok: false, error: "Nothing to update" }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    for (const op of lineOps) {
      if (op.op === "update")
        await tx.salesOrderLine.update({ where: { id: op.lineId! }, data: op.data! });
      if (op.op === "create")
        await tx.salesOrderLine.create({
          data: op.data as Parameters<typeof tx.salesOrderLine.create>[0]["data"],
        });
    }
    for (const a of amendments) {
      await tx.orderAmendment.create({
        data: { salesOrderId: order.id, ...a, reason: amendmentReason, source: "API" },
      });
    }
    await tx.salesOrder.update({
      where: { id: order.id },
      data: { ...data, updatedAt: new Date() },
    });
  });

  const body = await serializeOrder(order.reference);
  return NextResponse.json(body);
}
