// Printable sales order confirmation.

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { asAddress, formatAddress } from "@/lib/address";
import { formatPence } from "@/lib/money";
import { lineNetPence, orderTotalsPence, taxTreatmentLabels } from "@/lib/sales";
import {
  DocTable,
  PrintShell,
  Td,
  Th,
  TotalsBlock,
  getPrintOrg,
  printDateFmt,
} from "../../shared";

export default async function PrintSalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, order] = await Promise.all([
    getPrintOrg(),
    db.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        channel: true,
        salesPerson: true,
        warehouse: true,
        deliveryLocation: true,
        lines: { include: { product: true } },
      },
    }),
  ]);
  if (!order) notFound();

  const lines = order.lines.filter((l) => l.quantity > 0);
  const totals = orderTotalsPence(lines, order.shippingPence, order.taxTreatment);
  const shipTo = [formatAddress(asAddress(order.deliveryAddress)), order.deliveryContact]
    .filter(Boolean)
    .join("\n");

  return (
    <PrintShell
      org={org}
      docTitle="Sales Order"
      reference={order.reference}
      parties={[
        { label: "Customer", body: [order.customer.name, order.customer.email].filter(Boolean).join("\n") },
        { label: "Deliver to", body: shipTo },
      ]}
      meta={[
        { label: "Order date", value: printDateFmt.format(order.orderDate) },
        { label: "Required by", value: order.requiredDate ? printDateFmt.format(order.requiredDate) : null },
        { label: "Customer PO", value: order.customerPoNumber },
        { label: "Channel ref", value: order.externalRef },
        { label: "Channel", value: order.channel?.name ?? null },
        { label: "Salesperson", value: order.salesPerson.name },
        { label: "Fulfil from", value: order.warehouse.name },
        { label: "Location code", value: order.deliveryLocation?.code ?? null },
        { label: "Ship via", value: order.shippingService },
        { label: "Amounts are", value: taxTreatmentLabels[order.taxTreatment] ?? order.taxTreatment },
      ]}
      notes={[order.shippingInstructions, order.notes].filter(Boolean).join("\n") || null}
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
          { label: "Net", value: formatPence(totals.netPence) },
          { label: "VAT", value: formatPence(totals.vatPence) },
          { label: "Total", value: formatPence(totals.grossPence), strong: true },
        ]}
      />
    </PrintShell>
  );
}
