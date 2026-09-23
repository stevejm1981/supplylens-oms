"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAvailability, getAvgLandedCosts } from "@/lib/queries";
import { orderTotalsPence } from "@/lib/sales";
import { recordMovement } from "@/lib/stock-ledger";
import { JOURNAL_ACCOUNTS, recordStockJournal } from "@/lib/journals";
import { nextRef } from "@/lib/settings";

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

export interface NewSalesOrderLine {
  productId: string;
  quantity: number; // in the ordered unit
  uomCode: string | null; // null = each; otherwise a ProductUom code ("PACK6")
  unitsPerUom: number; // conversion snapshot, 1 for each
  unitPricePence: number; // per ordered unit (per pack when uomCode set)
  discountPct: number;
}


function revalidateSales(id?: string) {
  revalidatePath("/sales-orders");
  if (id) revalidatePath(`/sales-orders/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/reports");
  revalidatePath("/stock");
  revalidatePath("/customers");
  revalidatePath("/salespeople");
  revalidatePath("/movements");
}

export async function createSalesOrder(input: {
  customerId: string;
  salesPersonId: string;
  warehouseId: string;
  channelId: string | null;
  deliveryLocationId: string | null;
  orderDate: string | null;
  requiredDate: string | null;
  customerPoNumber: string | null;
  externalRef: string | null;
  deliveryAddress: string | null;
  deliveryContact: string | null;
  shippingService: string | null;
  shippingInstructions: string | null;
  giftMessage: string | null;
  shippingPence: number;
  taxTreatment: string;
  isPreOrder: boolean;
  notes: string | null;
  lines: NewSalesOrderLine[];
}): Promise<ActionResult> {
  if (!input.customerId) return { ok: false, error: "Customer is required" };
  if (!input.salesPersonId) return { ok: false, error: "Salesperson is required" };
  if (!input.warehouseId) return { ok: false, error: "Warehouse is required" };
  const lines = input.lines.filter((l) => l.productId && l.quantity > 0);
  if (lines.length === 0) {
    return { ok: false, error: "At least one line with a quantity is required" };
  }
  if (lines.some((l) => l.discountPct < 0 || l.discountPct > 100)) {
    return { ok: false, error: "Line discount must be between 0 and 100%" };
  }
  if (lines.some((l) => !Number.isInteger(l.unitsPerUom) || l.unitsPerUom < 1)) {
    return { ok: false, error: "Units per pack must be a whole number ≥ 1" };
  }
  // Pack/case units are STANDARD-only, a bundle already explodes to
  // components, so a "pack of bundles" would double-convert stock.
  const uomLineProducts = lines.filter((l) => l.uomCode);
  if (uomLineProducts.length > 0) {
    const bundles = await db.product.findMany({
      where: { id: { in: uomLineProducts.map((l) => l.productId) }, type: "BUNDLE" },
      select: { sku: true },
    });
    if (bundles.length > 0) {
      return {
        ok: false,
        error: `Bundles are sold in eaches, remove the pack unit on ${bundles.map((b) => b.sku).join(", ")}`,
      };
    }
  }
  try {
    const count = await db.salesOrder.count();
    const order = await db.salesOrder.create({
      data: {
        reference: await nextRef("salesOrder", count),
        customerId: input.customerId,
        salesPersonId: input.salesPersonId,
        warehouseId: input.warehouseId,
        channelId: input.channelId,
        deliveryLocationId: input.deliveryLocationId,
        orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
        requiredDate: input.requiredDate ? new Date(input.requiredDate) : null,
        customerPoNumber: input.customerPoNumber?.trim() || null,
        externalRef: input.externalRef?.trim() || null,
        deliveryAddress: input.deliveryAddress?.trim() || null,
        deliveryContact: input.deliveryContact?.trim() || null,
        shippingService: input.shippingService?.trim() || null,
        shippingInstructions: input.shippingInstructions?.trim() || null,
        giftMessage: input.giftMessage?.trim() || null,
        shippingPence: input.shippingPence || 0,
        taxTreatment: ["EXCLUSIVE", "INCLUSIVE", "NONE"].includes(input.taxTreatment)
          ? input.taxTreatment
          : "EXCLUSIVE",
        isPreOrder: input.isPreOrder,
        notes: input.notes?.trim() || null,
        // originalQty preserves what the customer asked for, forever.
        lines: { create: lines.map((l) => ({ ...l, originalQty: l.quantity })) },
      },
    });
    revalidateSales(order.id);
    return { ok: true, id: order.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
}

/**
 * Amend confirmed quantities on a held (DRAFT) order. Original quantities are
 * never touched; every change is recorded with old → new and a reason.
 * A confirmed quantity of 0 short-cancels the line but keeps it for reporting.
 */
export async function amendOrderQuantities(
  orderId: string,
  changes: { orderLineId: string; quantity: number }[],
  reason: string,
): Promise<ActionResult> {
  const order = await db.salesOrder.findUnique({
    where: { id: orderId },
    include: { lines: { include: { product: true } } },
  });
  if (!order) return { ok: false, error: "Sales order not found" };
  if (order.status !== "DRAFT") {
    return { ok: false, error: "Only held (draft) orders can be amended, use the amendment process after release" };
  }
  const real = changes.filter((c) => {
    const line = order.lines.find((l) => l.id === c.orderLineId);
    return line && c.quantity !== line.quantity;
  });
  if (real.length === 0) return { ok: false, error: "No quantities changed" };
  if (!reason.trim()) return { ok: false, error: "A reason is required when quantities change" };
  for (const c of real) {
    if (!Number.isInteger(c.quantity) || c.quantity < 0) {
      return { ok: false, error: "Quantities must be whole numbers ≥ 0 (0 = short-cancel the line)" };
    }
  }
  try {
    await db.$transaction(async (tx) => {
      for (const c of real) {
        const line = order.lines.find((l) => l.id === c.orderLineId)!;
        await tx.salesOrderLine.update({
          where: { id: line.id },
          data: { quantity: c.quantity },
        });
        await tx.orderAmendment.create({
          data: {
            salesOrderId: order.id,
            sku: line.product.sku,
            field: c.quantity === 0 ? "line-cancelled" : "quantity",
            oldValue: String(line.quantity),
            newValue: String(c.quantity),
            reason: reason.trim(),
            source: "UI",
          },
        });
      }
      await tx.salesOrder.update({ where: { id: orderId }, data: { updatedAt: new Date() } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Amendment failed" };
  }
  revalidateSales(orderId);
  return { ok: true };
}

// ── Despatch documents (NetSuite item-fulfilment style) ─────────────────────
// The order is the commercial agreement; each Despatch is one physical shipment
// against it. Stock moves and COGS snapshots happen when a despatch goes out.

function revalidateDespatch(orderId: string) {
  revalidateSales(orderId);
  revalidatePath("/despatches");
  revalidatePath("/products");
  revalidatePath("/warehouses");
}

/** Ordered minus already planned across all despatches, per order line. */
async function outstandingByOrderLine(orderId: string): Promise<Map<string, number>> {
  const order = await db.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { lines: true, despatches: { include: { lines: true } } },
  });
  const planned = new Map<string, number>();
  for (const d of order.despatches) {
    for (const l of d.lines) {
      planned.set(l.orderLineId, (planned.get(l.orderLineId) ?? 0) + l.quantity);
    }
  }
  return new Map(
    order.lines.map((l) => [l.id, l.quantity - (planned.get(l.id) ?? 0)]),
  );
}

export async function createDespatch(
  orderId: string,
  lines: { orderLineId: string; quantity: number }[],
): Promise<ActionResult> {
  const order = await db.salesOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Sales order not found" };
  if (order.status === "INVOICED") {
    return { ok: false, error: "Invoiced orders cannot take new despatches" };
  }
  const requested = lines.filter((l) => l.quantity > 0);
  if (requested.length === 0) {
    return { ok: false, error: "Enter a quantity on at least one line" };
  }
  const outstanding = await outstandingByOrderLine(orderId);
  for (const req of requested) {
    const remaining = outstanding.get(req.orderLineId);
    if (remaining === undefined) return { ok: false, error: "Line does not match the order" };
    if (!Number.isInteger(req.quantity) || req.quantity > remaining) {
      return {
        ok: false,
        error: `Only ${remaining} outstanding on that line, already planned on another despatch?`,
      };
    }
  }
  try {
    const count = await db.despatch.count();
    await db.$transaction(async (tx) => {
      await tx.despatch.create({
        data: {
          reference: await nextRef("despatch", count),
          salesOrderId: orderId,
          shippingService: order.shippingService,
          lines: { create: requested },
        },
      });
      await tx.salesOrder.update({
        where: { id: orderId },
        // DRAFT flips to OPEN; otherwise just stamp the modification.
        data: order.status === "DRAFT" ? { status: "OPEN" } : { updatedAt: new Date() },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Create failed" };
  }
  revalidateDespatch(orderId);
  return { ok: true };
}

export async function markDespatchPicked(
  id: string,
  picks: { despatchLineId: string; pickedQty: number }[],
): Promise<ActionResult> {
  const despatch = await db.despatch.findUnique({ where: { id }, include: { lines: true } });
  if (!despatch) return { ok: false, error: "Despatch not found" };
  if (despatch.status !== "PICKING") {
    return { ok: false, error: "Only despatches in picking can be marked picked" };
  }
  for (const line of despatch.lines) {
    const pick = picks.find((p) => p.despatchLineId === line.id);
    const qty = pick?.pickedQty ?? 0;
    if (!Number.isInteger(qty) || qty < 0 || qty > line.quantity) {
      return { ok: false, error: `Picked quantity must be between 0 and ${line.quantity}` };
    }
  }
  if (picks.every((p) => p.pickedQty === 0)) {
    return { ok: false, error: "Nothing picked, enter at least one quantity" };
  }
  try {
    await db.$transaction(async (tx) => {
      for (const line of despatch.lines) {
        const pick = picks.find((p) => p.despatchLineId === line.id);
        await tx.despatchLine.update({
          where: { id: line.id },
          data: { pickedQty: pick?.pickedQty ?? 0 },
        });
      }
      await tx.despatch.update({
        where: { id },
        data: { status: "PICKED", pickedAt: new Date() },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Pick failed" };
  }
  revalidateDespatch(despatch.salesOrderId);
  return { ok: true };
}

/**
 * Despatch the picked goods: stock check & deduction in the order's warehouse
 * (bundles explode to components), COGS snapshot at current average landed cost,
 * tracking captured. Order lines get a despatched-quantity-weighted COGS so
 * margin reporting stays a simple qty × unitCogs everywhere.
 */
export async function despatchDespatch(
  id: string,
  shipping: { shippingService?: string | null; trackingNumber?: string | null },
): Promise<ActionResult> {
  const despatch = await db.despatch.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          orderLine: { include: { product: { include: { bomLines: true } } } },
        },
      },
      salesOrder: {
        include: {
          warehouse: true,
          lines: {
            include: {
              despatchLines: { select: { despatchedQty: true } },
              product: { include: { bomLines: true } },
            },
          },
        },
      },
    },
  });
  if (!despatch) return { ok: false, error: "Despatch not found" };
  if (despatch.status !== "PICKED") {
    return { ok: false, error: "Mark the despatch picked before despatching it" };
  }
  const order = despatch.salesOrder;

  // Physical requirement is always base units (eaches): picked packs multiply
  // by the line's conversion snapshot; bundles explode to components.
  const required = new Map<string, number>();
  for (const line of despatch.lines) {
    if (line.pickedQty === 0) continue;
    const product = line.orderLine.product;
    if (product.type === "BUNDLE") {
      if (product.bomLines.length === 0) {
        return { ok: false, error: `${product.sku} is a bundle with no BOM` };
      }
      for (const bom of product.bomLines) {
        required.set(
          bom.componentId,
          (required.get(bom.componentId) ?? 0) + bom.quantity * line.pickedQty,
        );
      }
    } else {
      required.set(
        line.orderLine.productId,
        (required.get(line.orderLine.productId) ?? 0) +
          line.pickedQty * line.orderLine.unitsPerUom,
      );
    }
  }

  const productIds = [...required.keys()];
  const [{ byProductWarehouse }, physicalProducts, avgCosts, customerReservations] =
    await Promise.all([
      getAvailability(),
      db.product.findMany({ where: { id: { in: productIds } } }),
      getAvgLandedCosts(),
      db.stockReservation.findMany({
        where: {
          status: "ACTIVE",
          warehouseId: order.warehouseId,
          customerId: order.customerId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
  const skuById = new Map(physicalProducts.map((p) => [p.id, p.sku]));
  const baseById = new Map(physicalProducts.map((p) => [p.id, p.baseCostPence]));

  // This order's own outstanding commitment (bundle-exploded), its despatch may
  // consume its own claim, plus any reservation held for this customer.
  const ownCommit = new Map<string, number>();
  for (const line of order.lines) {
    const outstandingUom =
      line.quantity - line.despatchLines.reduce((s, d) => s + d.despatchedQty, 0);
    if (outstandingUom <= 0) continue;
    const outstanding = outstandingUom * line.unitsPerUom; // base units
    const parts =
      line.product.type === "BUNDLE"
        ? line.product.bomLines.map((b) => [b.componentId, b.quantity * outstanding] as const)
        : ([[line.productId, outstanding]] as const);
    for (const [productId, qty] of parts) {
      ownCommit.set(productId, (ownCommit.get(productId) ?? 0) + qty);
    }
  }
  const reservedForCustomer = new Map<string, number>();
  for (const r of customerReservations) {
    reservedForCustomer.set(r.productId, (reservedForCustomer.get(r.productId) ?? 0) + r.quantity);
  }

  const shortages: string[] = [];
  for (const [productId, qty] of required) {
    const a = byProductWarehouse.get(`${productId}|${order.warehouseId}`);
    const onHand = a?.onHand ?? 0;
    const own = ownCommit.get(productId) ?? 0;
    const resCust = reservedForCustomer.get(productId) ?? 0;
    const usable = Math.min(onHand, (a?.available ?? 0) + own + resCust);
    if (usable < qty) {
      const committedOthers = Math.max(0, (a?.committed ?? 0) - own);
      const reservedOthers = Math.max(0, (a?.reserved ?? 0) - resCust);
      shortages.push(
        `${skuById.get(productId) ?? productId}: need ${qty}, only ${Math.max(0, usable)} usable (${onHand} on hand, ${committedOthers} committed to other orders, ${reservedOthers} reserved)`,
      );
    }
  }
  if (shortages.length > 0) {
    return {
      ok: false,
      error: `Cannot despatch from ${order.warehouse.name}, ${shortages.join("; ")}`,
    };
  }

  const unitCost = (productId: string) =>
    avgCosts.get(productId) ?? baseById.get(productId) ?? 0;

  try {
    await db.$transaction(async (tx) => {
      for (const [productId, qty] of required) {
        await tx.stockLevel.update({
          where: { productId_warehouseId: { productId, warehouseId: order.warehouseId } },
          data: { quantity: { decrement: qty } },
        });
        await recordMovement(tx, {
          productId,
          warehouseId: order.warehouseId,
          quantity: -qty,
          type: "DESPATCH",
          reference: despatch.reference,
          referenceId: order.id,
        });
        // Consume this customer's reservations for the despatched goods,
        // oldest first, the pre-order hold fulfils itself.
        let toConsume = qty;
        for (const r of customerReservations.filter((x) => x.productId === productId)) {
          if (toConsume <= 0) break;
          const take = Math.min(toConsume, r.quantity);
          toConsume -= take;
          const remaining = r.quantity - take;
          await tx.stockReservation.update({
            where: { id: r.id },
            data:
              remaining === 0
                ? { quantity: 0, status: "RELEASED", releasedAt: new Date() }
                : { quantity: remaining },
          });
          r.quantity = remaining;
        }
      }
      let cogsTotal = 0;
      for (const line of despatch.lines) {
        const product = line.orderLine.product;
        // COGS per ORDERED unit (per pack for pack lines), so margin maths
        // stays qty × unitCogs against the per-pack sell price everywhere.
        const cogs =
          product.type === "BUNDLE"
            ? product.bomLines.reduce(
                (s, bom) => s + unitCost(bom.componentId) * bom.quantity,
                0,
              )
            : unitCost(line.orderLine.productId) * line.orderLine.unitsPerUom;
        cogsTotal += line.pickedQty * cogs;
        await tx.despatchLine.update({
          where: { id: line.id },
          data: { despatchedQty: line.pickedQty, unitCogsPence: cogs },
        });
        // Weighted write-back so order-level margin stays qty × unitCogs.
        const siblings = await tx.despatchLine.findMany({
          where: { orderLineId: line.orderLineId, despatchedQty: { gt: 0 } },
        });
        const totalQty = siblings.reduce((s, x) => s + x.despatchedQty, 0) + line.pickedQty;
        const totalCost =
          siblings.reduce((s, x) => s + x.despatchedQty * (x.unitCogsPence ?? 0), 0) +
          line.pickedQty * cogs;
        await tx.salesOrderLine.update({
          where: { id: line.orderLineId },
          data: { unitCogsPence: totalQty > 0 ? totalCost / totalQty : cogs },
        });
      }
      // The accounting shadow: stock leaves the balance sheet at what it
      // really cost (average landed), COGS takes it, Xero-ready.
      await recordStockJournal(tx, {
        type: "DESPATCH_COGS",
        sourceRef: despatch.reference,
        sourceId: despatch.id,
        memo: `COGS for ${despatch.reference} (${order.reference})`,
        lines: [
          { account: JOURNAL_ACCOUNTS.cogs, debitPence: Math.round(cogsTotal) },
          { account: JOURNAL_ACCOUNTS.stock, creditPence: Math.round(cogsTotal) },
        ],
      });
      await tx.despatch.update({
        where: { id },
        data: {
          status: "DESPATCHED",
          despatchedAt: new Date(),
          shippingService: shipping.shippingService?.trim() || despatch.shippingService,
          trackingNumber: shipping.trackingNumber?.trim() || null,
        },
      });
      await tx.salesOrder.update({
        where: { id: order.id },
        data: {
          updatedAt: new Date(),
          ...(order.dispatchedAt ? {} : { dispatchedAt: new Date() }),
        },
      });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Despatch failed" };
  }
  revalidateDespatch(order.id);
  return { ok: true };
}

export async function deleteDespatch(id: string): Promise<ActionResult> {
  const despatch = await db.despatch.findUnique({ where: { id } });
  if (!despatch) return { ok: false, error: "Despatch not found" };
  if (despatch.status === "DESPATCHED") {
    return { ok: false, error: "Despatched goods have left, raise a credit instead" };
  }
  await db.$transaction([
    db.despatch.delete({ where: { id } }),
    db.salesOrder.update({
      where: { id: despatch.salesOrderId },
      data: { updatedAt: new Date() },
    }),
  ]);
  revalidateDespatch(despatch.salesOrderId);
  return { ok: true };
}

export async function invoiceSalesOrder(id: string): Promise<ActionResult> {
  const order = await db.salesOrder.findUnique({
    where: { id },
    include: {
      lines: { include: { despatchLines: true } },
      invoice: true,
      customer: true,
    },
  });
  if (!order) return { ok: false, error: "Sales order not found" };
  if (order.status !== "OPEN") {
    return { ok: false, error: "Only open orders can be invoiced" };
  }
  if (order.invoice) return { ok: false, error: "Already invoiced" };
  const undelivered = order.lines.filter(
    (l) => l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0) < l.quantity,
  );
  if (undelivered.length > 0) {
    return {
      ok: false,
      error: "Despatch all lines before invoicing (partial invoicing is a future step)",
    };
  }

  const { netPence, vatPence } = orderTotalsPence(
    order.lines,
    order.shippingPence,
    order.taxTreatment,
  );
  const invoiceDate = new Date();
  const dueDate = new Date(
    invoiceDate.getTime() + order.customer.paymentTermsDays * 24 * 60 * 60 * 1000,
  );
  try {
    const count = await db.invoice.count();
    await db.$transaction([
      db.invoice.create({
        data: {
          number: await nextRef("invoice", count),
          salesOrderId: id,
          invoiceDate,
          dueDate,
          netPence,
          vatPence,
          grossPence: netPence + vatPence,
        },
      }),
      db.salesOrder.update({ where: { id }, data: { status: "INVOICED" } }),
    ]);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invoicing failed" };
  }
  revalidateSales(id);
  return { ok: true };
}

export interface CreditLineInput {
  orderLineId: string;
  quantity: number;
  unitPricePence: number;
}

/**
 * Raise a credit note against an INVOICED order. Quantities are capped at
 * ordered minus already-credited per line. Restock returns goods to a warehouse
 * (bundles explode to components) and reverses COGS; a write-off reverses
 * revenue only, the cost stays spent.
 */
export async function createCreditNote(input: {
  salesOrderId: string;
  reason: string | null;
  restock: boolean;
  warehouseId: string | null;
  lines: CreditLineInput[];
}): Promise<ActionResult> {
  const order = await db.salesOrder.findUnique({
    where: { id: input.salesOrderId },
    include: {
      lines: { include: { product: { include: { bomLines: true } } } },
      invoice: true,
      creditNotes: { include: { lines: true } },
    },
  });
  if (!order) return { ok: false, error: "Sales order not found" };
  if (order.status !== "INVOICED" || !order.invoice) {
    return { ok: false, error: "Only invoiced orders can be credited" };
  }
  if (input.restock && !input.warehouseId) {
    return { ok: false, error: "Choose a warehouse to restock into" };
  }

  const requested = input.lines.filter((l) => l.quantity > 0);
  if (requested.length === 0) {
    return { ok: false, error: "Enter a quantity to credit on at least one line" };
  }

  // Cap: per order line, ordered qty minus already-credited qty (matched by product).
  const creditedByProduct = new Map<string, number>();
  for (const note of order.creditNotes) {
    for (const l of note.lines) {
      creditedByProduct.set(l.productId, (creditedByProduct.get(l.productId) ?? 0) + l.quantity);
    }
  }
  const orderLineById = new Map(order.lines.map((l) => [l.id, l]));
  for (const req of requested) {
    const line = orderLineById.get(req.orderLineId);
    if (!line) return { ok: false, error: "Credit line does not match the order" };
    const already = creditedByProduct.get(line.productId) ?? 0;
    const remaining = line.quantity - already;
    if (req.quantity > remaining) {
      return {
        ok: false,
        error: `${line.product.sku}: only ${remaining} left to credit (ordered ${line.quantity}, credited ${already})`,
      };
    }
    if (!Number.isInteger(req.quantity)) {
      return { ok: false, error: "Credit quantities must be whole units" };
    }
  }

  // Credits follow the order's tax treatment (entered prices are inc or ex VAT).
  const { netPence, vatPence } = orderTotalsPence(requested, 0, order.taxTreatment);
  if (netPence <= 0) return { ok: false, error: "Credit value must be greater than zero" };

  try {
    const count = await db.creditNote.count();
    const number = await nextRef("creditNote", count);
    await db.$transaction(async (tx) => {
      await tx.creditNote.create({
        data: {
          number,
          salesOrderId: order.id,
          reason: input.reason?.trim() || null,
          restock: input.restock,
          warehouseId: input.restock ? input.warehouseId : null,
          netPence,
          vatPence,
          grossPence: netPence + vatPence,
          lines: {
            create: requested.map((req) => {
              const line = orderLineById.get(req.orderLineId)!;
              return {
                productId: line.productId,
                quantity: req.quantity,
                unitsPerUom: line.unitsPerUom,
                unitPricePence: req.unitPricePence,
                unitCogsPence: line.unitCogsPence,
              };
            }),
          },
        },
      });
      await tx.salesOrder.update({
        where: { id: order.id },
        data: { updatedAt: new Date() },
      });
      if (input.restock && input.warehouseId) {
        // Return physical goods (bundles explode to components).
        const returned = new Map<string, number>();
        for (const req of requested) {
          const line = orderLineById.get(req.orderLineId)!;
          if (line.product.type === "BUNDLE") {
            for (const bom of line.product.bomLines) {
              returned.set(
                bom.componentId,
                (returned.get(bom.componentId) ?? 0) + bom.quantity * req.quantity,
              );
            }
          } else {
            returned.set(
              line.productId,
              (returned.get(line.productId) ?? 0) + req.quantity * line.unitsPerUom,
            );
          }
        }
        for (const [productId, qty] of returned) {
          await tx.stockLevel.upsert({
            where: {
              productId_warehouseId: { productId, warehouseId: input.warehouseId },
            },
            create: { productId, warehouseId: input.warehouseId, quantity: qty },
            update: { quantity: { increment: qty } },
          });
          await recordMovement(tx, {
            productId,
            warehouseId: input.warehouseId,
            quantity: qty,
            type: "CREDIT_RESTOCK",
            reference: number,
            referenceId: order.id,
          });
        }
        // Reverse the COGS for what physically came back.
        const restockValue = requested.reduce((s, req) => {
          const line = orderLineById.get(req.orderLineId)!;
          return s + req.quantity * (line.unitCogsPence ?? 0);
        }, 0);
        await recordStockJournal(tx, {
          type: "CREDIT_RESTOCK",
          sourceRef: number,
          sourceId: order.id,
          memo: `Restock on credit ${number} (${order.reference})`,
          lines: [
            { account: JOURNAL_ACCOUNTS.stock, debitPence: Math.round(restockValue) },
            { account: JOURNAL_ACCOUNTS.cogs, creditPence: Math.round(restockValue) },
          ],
        });
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Credit failed" };
  }
  revalidateSales(input.salesOrderId);
  revalidatePath("/credits");
  return { ok: true };
}

/**
 * Cover a back-ordered order's shortfall: one draft PO per supplier for the
 * missing base units, each line tied back to this order by a customer-held
 * PENDING reservation against that PO. The goods secure themselves on receipt
 * and consume themselves at despatch, and both documents link to each other.
 */
export async function coverShortfall(
  orderId: string,
): Promise<{ ok: true; poReferences: string[] } | { ok: false; error: string }> {
  const { getOrderBackorder } = await import("@/lib/backorder");
  const { nextRef } = await import("@/lib/settings");
  const order = await db.salesOrder.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Sales order not found" };
  const { shortfalls } = await getOrderBackorder(orderId);
  if (shortfalls.length === 0) {
    return { ok: false, error: "Nothing to cover, no uncovered shortfall on this order" };
  }
  const unsourced = shortfalls.filter((s) => !s.supplierId);
  if (unsourced.length > 0) {
    return {
      ok: false,
      error: `No supplier set on ${unsourced.map((s) => s.sku).join(", ")}, set one first so the PO knows where to go`,
    };
  }
  const costs = new Map(
    (
      await db.product.findMany({
        where: { id: { in: shortfalls.map((s) => s.productId) } },
        select: { id: true, baseCostPence: true },
      })
    ).map((p) => [p.id, p.baseCostPence]),
  );

  const bySupplier = new Map<string, typeof shortfalls>();
  for (const s of shortfalls) {
    const list = bySupplier.get(s.supplierId!) ?? [];
    list.push(s);
    bySupplier.set(s.supplierId!, list);
  }

  const poReferences: string[] = [];
  try {
    await db.$transaction(async (tx) => {
      let poCount = await tx.purchaseOrder.count();
      let rsvCount = await tx.stockReservation.count();
      for (const [supplierId, lines] of bySupplier) {
        const reference = await nextRef("purchaseOrder", poCount, tx);
        poCount += 1;
        const po = await tx.purchaseOrder.create({
          data: {
            reference,
            supplierId,
            notes: `Back-order cover for ${order.reference}`,
            lines: {
              create: lines.map((l) => ({
                productId: l.productId,
                quantity: l.shortfall,
                unitCostPence: costs.get(l.productId) ?? 0,
              })),
            },
          },
        });
        poReferences.push(reference);
        for (const l of lines) {
          await tx.stockReservation.create({
            data: {
              reference: await nextRef("reservation", rsvCount, tx),
              productId: l.productId,
              warehouseId: order.warehouseId,
              quantity: l.shortfall,
              customerId: order.customerId,
              purchaseOrderId: po.id,
              salesOrderId: order.id,
              status: "PENDING",
              reason: `Back-order cover for ${order.reference}`,
            },
          });
          rsvCount += 1;
        }
      }
      await tx.salesOrder.update({ where: { id: orderId }, data: { updatedAt: new Date() } });
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Cover failed" };
  }
  revalidateSales(orderId);
  revalidatePath("/purchase-orders");
  revalidatePath("/reservations");
  revalidatePath("/replenishment");
  return { ok: true, poReferences };
}

export async function deleteSalesOrder(id: string): Promise<ActionResult> {
  const order = await db.salesOrder.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Sales order not found" };
  if (order.status !== "DRAFT") {
    return { ok: false, error: "Only draft orders can be deleted" };
  }
  await db.salesOrder.delete({ where: { id } });
  revalidateSales();
  return { ok: true };
}
