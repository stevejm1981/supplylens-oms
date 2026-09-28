// Printable despatch (delivery) note: what's in the shipment, no prices.
// Goes in the box or to the carrier; the pick list remains the warehouse's
// walking document.

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { asAddress, formatAddress } from "@/lib/address";
import {
  DocTable,
  PrintShell,
  Td,
  Th,
  getPrintOrg,
  printDateFmt,
} from "../../shared";

export default async function PrintDespatchNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, despatch] = await Promise.all([
    getPrintOrg(),
    db.despatch.findUnique({
      where: { id },
      include: {
        salesOrder: { include: { customer: true, warehouse: true } },
        lines: { include: { orderLine: { include: { product: true } } } },
      },
    }),
  ]);
  if (!despatch) notFound();
  const order = despatch.salesOrder;
  const despatched = despatch.status === "DESPATCHED";
  const rows = despatch.lines
    .map((l) => ({
      id: l.id,
      sku: l.orderLine.product.sku,
      name: l.orderLine.product.name,
      unit: l.orderLine.uomCode
        ? `${l.orderLine.uomCode} (× ${l.orderLine.unitsPerUom})`
        : "each",
      qty: despatched ? l.despatchedQty : l.quantity,
      ordered: l.orderLine.quantity,
    }))
    .filter((r) => r.qty > 0);

  return (
    <PrintShell
      org={org}
      docTitle="Despatch Note"
      reference={despatch.reference}
      parties={[
        {
          label: "Deliver to",
          body: [formatAddress(asAddress(order.deliveryAddress)), order.deliveryContact]
            .filter(Boolean)
            .join("\n"),
        },
        { label: "Customer", body: order.customer.name },
      ]}
      meta={[
        { label: "Order ref", value: order.reference },
        { label: "Customer PO", value: order.customerPoNumber },
        { label: "Channel ref", value: order.externalRef },
        {
          label: "Despatched",
          value: despatch.despatchedAt ? printDateFmt.format(despatch.despatchedAt) : "Not yet despatched",
        },
        { label: "From", value: order.warehouse.name },
        { label: "Service", value: despatch.shippingService ?? order.shippingService },
        { label: "Tracking", value: despatch.trackingNumber },
        { label: "Shipment ref", value: despatch.externalRef },
      ]}
      notes={order.shippingInstructions}
      footNote="Please check the goods against this note on arrival and report shortages or damage within 48 hours."
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th>Unit</Th>
            <Th right>Ordered</Th>
            <Th right>{despatched ? "Despatched" : "To despatch"}</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td mono>{r.sku}</Td>
              <Td>{r.name}</Td>
              <Td>{r.unit}</Td>
              <Td right>{r.ordered}</Td>
              <Td right>{r.qty}</Td>
            </tr>
          ))}
        </tbody>
      </DocTable>
    </PrintShell>
  );
}
