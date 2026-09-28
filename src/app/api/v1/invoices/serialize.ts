// One representation of an invoice for the API: the full financial document
// an accounting sync (Xero) or an EDI INVOIC needs, lines included. Lines
// come from the sales order (an invoice is only raised once fully
// despatched); short-cancelled lines (confirmed quantity 0) never invoice.

import { db } from "@/lib/db";
import { asAddress, formatAddress } from "@/lib/address";
import { lineNetPence } from "@/lib/sales";

export const invoiceInclude = {
  salesOrder: {
    select: {
      reference: true,
      externalRef: true,
      customerPoNumber: true,
      taxTreatment: true,
      shippingPence: true,
      deliveryAddress: true,
      deliveryContact: true,
      customer: { select: { code: true, name: true } },
      channel: { select: { code: true } },
      deliveryLocation: { select: { code: true, name: true } },
      lines: {
        include: { product: { select: { sku: true, name: true } } },
      },
    },
  },
} as const;

type InvoiceWithOrder = NonNullable<
  Awaited<ReturnType<typeof db.invoice.findFirst<{ include: typeof invoiceInclude }>>>
>;

export function serializeInvoice(inv: InvoiceWithOrder) {
  const order = inv.salesOrder;
  return {
    number: inv.number,
    updatedAt: inv.updatedAt,
    salesOrder: order.reference,
    externalRef: order.externalRef,
    customerPoNumber: order.customerPoNumber,
    customer: order.customer.code,
    customerName: order.customer.name,
    channel: order.channel?.code ?? null,
    currency: "GBP",
    taxTreatment: order.taxTreatment,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate,
    paidAt: inv.paidAt,
    paymentStatus: inv.paidAt
      ? "PAID"
      : inv.dueDate && inv.dueDate.getTime() < Date.now()
        ? "OVERDUE"
        : "UNPAID",
    delivery: {
      location: order.deliveryLocation?.code ?? null,
      locationName: order.deliveryLocation?.name ?? null,
      address: asAddress(order.deliveryAddress), // structured {name, company, line1..3, city, province, postcode, country}
      addressFormatted: formatAddress(asAddress(order.deliveryAddress)) || null,
      contact: order.deliveryContact,
    },
    lines: order.lines
      .filter((l) => l.quantity > 0)
      .map((l) => ({
        sku: l.product.sku,
        name: l.product.name,
        quantity: l.quantity,
        uom: l.uomCode, // null = each
        unitsPerUom: l.unitsPerUom,
        unitPricePence: l.unitPricePence, // per ordered unit, as entered under taxTreatment
        discountPct: l.discountPct,
        lineNetPence: lineNetPence(l), // qty × price × (1 − discount), pre-VAT-split
        tags: l.tags,
      })),
    shippingPence: order.shippingPence, // carriage charged to the customer
    netPence: inv.netPence,
    vatPence: inv.vatPence,
    grossPence: inv.grossPence,
  };
}
