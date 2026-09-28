// Printable customer return (RMA): what's expected back, and once
// received, how each line was triaged (restock vs write-off).

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import {
  DocTable,
  PrintShell,
  Td,
  Th,
  getPrintOrg,
  printDateFmt,
} from "../../shared";

export default async function PrintCustomerReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, rma] = await Promise.all([
    getPrintOrg(),
    db.customerReturn.findUnique({
      where: { id },
      include: {
        salesOrder: { include: { customer: true, invoice: true } },
        warehouse: true,
        creditNote: true,
        lines: { include: { orderLine: { include: { product: true } } } },
      },
    }),
  ]);
  if (!rma) notFound();
  const received = rma.status === "RECEIVED";

  return (
    <PrintShell
      org={org}
      docTitle="Customer Return"
      reference={rma.reference}
      parties={[
        { label: "Customer", body: rma.salesOrder.customer.name },
        { label: "Return to", body: [org.name, rma.warehouse.name, org.addressBlock].filter(Boolean).join("\n") },
      ]}
      meta={[
        { label: "Status", value: received ? "Received" : "Awaiting goods" },
        { label: "Received", value: rma.receivedAt ? printDateFmt.format(rma.receivedAt) : null },
        { label: "Against order", value: rma.salesOrder.reference },
        { label: "Against invoice", value: rma.salesOrder.invoice?.number ?? null },
        { label: "Credit note", value: rma.creditNote?.number ?? null },
      ]}
      notes={rma.reason}
      footNote={`Please include this note with the goods and quote ${rma.reference}.`}
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th>Unit</Th>
            <Th right>Expected</Th>
            {received ? <Th right>Restocked</Th> : null}
            {received ? <Th right>Written off</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rma.lines.map((l) => (
            <tr key={l.id}>
              <Td mono>{l.orderLine.product.sku}</Td>
              <Td>{l.orderLine.product.name}</Td>
              <Td>
                {l.orderLine.uomCode
                  ? `${l.orderLine.uomCode} (× ${l.orderLine.unitsPerUom})`
                  : "each"}
              </Td>
              <Td right>{l.quantity}</Td>
              {received ? <Td right>{l.restockQty}</Td> : null}
              {received ? <Td right>{l.writeOffQty}</Td> : null}
            </tr>
          ))}
        </tbody>
      </DocTable>
    </PrintShell>
  );
}
