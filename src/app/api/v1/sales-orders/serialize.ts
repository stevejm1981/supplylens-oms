// One representation of a sales order for the API, used by GET and returned
// by PATCH so a client never needs a follow-up read.

import { db } from "@/lib/db";
import { fillRates, orderTotalsPence } from "@/lib/sales";

export async function serializeOrder(reference: string) {
  const order = await db.salesOrder.findUnique({
    where: { reference: reference.toUpperCase() },
    include: {
      customer: { select: { code: true, name: true } },
      channel: { select: { code: true } },
      deliveryLocation: { select: { code: true, name: true } },
      lines: { include: { product: { select: { sku: true } }, despatchLines: true } },
      despatches: true,
      invoice: true,
    },
  });
  if (!order) return null;

  const ordered = order.lines.reduce((s, l) => s + l.quantity, 0);
  const despatched = order.lines.reduce(
    (s, l) => s + l.despatchLines.reduce((x, d) => x + d.despatchedQty, 0),
    0,
  );
  const totals = orderTotalsPence(order.lines, order.shippingPence, order.taxTreatment);
  const fill = fillRates(
    order.lines.map((l) => ({
      originalQty: l.originalQty,
      quantity: l.quantity,
      despatchedQty: l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0),
      unitsPerUom: l.unitsPerUom,
    })),
  );

  return {
    ok: true,
    reference: order.reference,
    updatedAt: order.updatedAt,
    status: order.status,
    fulfilment:
      despatched === 0 ? "UNFULFILLED" : despatched >= ordered ? "FULFILLED" : "PARTIAL",
    isPreOrder: order.isPreOrder,
    customer: order.customer.code,
    channel: order.channel?.code ?? null,
    externalRef: order.externalRef,
    customerPoNumber: order.customerPoNumber,
    taxTreatment: order.taxTreatment,
    orderDate: order.orderDate,
    requiredDate: order.requiredDate,
    delivery: {
      location: order.deliveryLocation?.code ?? null,
      address: order.deliveryAddress,
      contact: order.deliveryContact,
      shippingService: order.shippingService,
      shippingInstructions: order.shippingInstructions,
      giftMessage: order.giftMessage,
    },
    shippingPence: order.shippingPence,
    notes: order.notes,
    totals,
    fillRates: fill,
    lines: order.lines.map((l) => ({
      sku: l.product.sku,
      originalQty: l.originalQty,
      quantity: l.quantity,
      uom: l.uomCode, // null = each
      unitsPerUom: l.unitsPerUom,
      baseQuantity: l.quantity * l.unitsPerUom, // eaches, what stock actually moves
      unitPricePence: l.unitPricePence,
      discountPct: l.discountPct,
      despatchedQty: l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0),
    })),
    despatches: order.despatches.map((d) => ({
      reference: d.reference,
      status: d.status,
      shippingService: d.shippingService,
      trackingNumber: d.trackingNumber,
      despatchedAt: d.despatchedAt,
    })),
    invoice: order.invoice
      ? {
          number: order.invoice.number,
          invoiceDate: order.invoice.invoiceDate,
          dueDate: order.invoice.dueDate,
          paidAt: order.invoice.paidAt,
          netPence: order.invoice.netPence,
          vatPence: order.invoice.vatPence,
          grossPence: order.invoice.grossPence,
        }
      : null,
  };
}
