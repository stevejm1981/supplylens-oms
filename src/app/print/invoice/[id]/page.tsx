// Printable VAT invoice. Lines are the billed order lines (quantity > 0,
// short-closed lines already amended down at invoicing), totals come from
// the invoice record itself, penny-exact as booked.

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { asAddress, formatAddress } from "@/lib/address";
import { formatPence } from "@/lib/money";
import { lineNetPence, taxTreatmentLabels } from "@/lib/sales";
import {
  DocTable,
  PrintShell,
  Td,
  Th,
  TotalsBlock,
  getPrintOrg,
  printDateFmt,
} from "../../shared";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, inv] = await Promise.all([
    getPrintOrg(),
    db.invoice.findUnique({
      where: { id },
      include: {
        salesOrder: {
          include: {
            customer: true,
            channel: true,
            deliveryLocation: true,
            lines: { include: { product: true } },
          },
        },
      },
    }),
  ]);
  if (!inv) notFound();
  const order = inv.salesOrder;
  const lines = order.lines.filter((l) => l.quantity > 0);
  const paymentStatus = inv.paidAt
    ? `Paid ${printDateFmt.format(inv.paidAt)}`
    : inv.dueDate && inv.dueDate.getTime() < Date.now()
      ? "Overdue"
      : "Unpaid";

  return (
    <PrintShell
      org={org}
      docTitle="Invoice"
      reference={inv.number}
      parties={[
        {
          label: "Bill to",
          body: [
            order.customer.name,
            formatAddress(asAddress(order.customer.deliveryAddress)),
            order.customer.email,
          ]
            .filter(Boolean)
            .join("\n"),
        },
        {
          label: "Deliver to",
          body: [formatAddress(asAddress(order.deliveryAddress)), order.deliveryContact]
            .filter(Boolean)
            .join("\n"),
        },
      ]}
      meta={[
        { label: "Invoice date", value: printDateFmt.format(inv.invoiceDate) },
        { label: "Due date", value: inv.dueDate ? printDateFmt.format(inv.dueDate) : null },
        { label: "Status", value: paymentStatus },
        { label: "Order ref", value: order.reference },
        { label: "Customer PO", value: order.customerPoNumber },
        { label: "Channel ref", value: order.externalRef },
        { label: "Location code", value: order.deliveryLocation?.code ?? null },
        { label: "Amounts are", value: taxTreatmentLabels[order.taxTreatment] ?? order.taxTreatment },
        { label: "Currency", value: "GBP" },
      ]}
      notes={order.notes}
      footNote={
        inv.dueDate
          ? `Payment terms: ${order.customer.paymentTermsDays} days. Please quote ${inv.number} on payment.`
          : `Please quote ${inv.number} on payment.`
      }
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th right>Qty</Th>
            <Th>Unit</Th>
            <Th right>Unit price</Th>
            <Th right>Disc %</Th>
            <Th right>Net</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <Td mono>{l.product.sku}</Td>
              <Td>{l.product.name}</Td>
              <Td right>{l.quantity}</Td>
              <Td>{l.uomCode ? `${l.uomCode} (× ${l.unitsPerUom})` : "each"}</Td>
              <Td right>{formatPence(l.unitPricePence)}</Td>
              <Td right>{l.discountPct > 0 ? `${l.discountPct}%` : ""}</Td>
              <Td right>{formatPence(lineNetPence(l))}</Td>
            </tr>
          ))}
        </tbody>
      </DocTable>
      <TotalsBlock
        rows={[
          ...(order.shippingPence > 0
            ? [{ label: "Carriage", value: formatPence(order.shippingPence) }]
            : []),
          { label: "Net", value: formatPence(inv.netPence) },
          { label: "VAT", value: formatPence(inv.vatPence) },
          { label: "Total", value: formatPence(inv.grossPence), strong: true },
        ]}
      />
    </PrintShell>
  );
}
