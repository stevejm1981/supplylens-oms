// Printable credit note. Totals come from the credit record, penny-exact
// as booked; restock vs refund-only is stated on the paper.

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { asAddress, formatAddress } from "@/lib/address";
import { formatPence } from "@/lib/money";
import {
  DocTable,
  PrintShell,
  Td,
  Th,
  TotalsBlock,
  getPrintOrg,
  printDateFmt,
} from "../../shared";

export default async function PrintCreditNotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, credit] = await Promise.all([
    getPrintOrg(),
    db.creditNote.findUnique({
      where: { id },
      include: {
        salesOrder: { include: { customer: true, invoice: true } },
        warehouse: true,
        customerReturn: true,
        lines: { include: { product: true } },
      },
    }),
  ]);
  if (!credit) notFound();
  const order = credit.salesOrder;

  return (
    <PrintShell
      org={org}
      docTitle="Credit Note"
      reference={credit.number}
      parties={[
        {
          label: "Credit to",
          body: [
            order.customer.name,
            formatAddress(asAddress(order.customer.deliveryAddress)),
            order.customer.email,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ]}
      meta={[
        { label: "Credit date", value: printDateFmt.format(credit.creditDate) },
        { label: "Against order", value: order.reference },
        { label: "Against invoice", value: order.invoice?.number ?? null },
        { label: "Customer PO", value: order.customerPoNumber },
        { label: "Return ref", value: credit.customerReturn?.reference ?? null },
        {
          label: "Goods",
          value: credit.restock
            ? `Returned to stock (${credit.warehouse?.name ?? "warehouse"})`
            : "Refund only, no goods returned",
        },
      ]}
      notes={credit.reason}
      footNote={`Please apply ${credit.number} against your account.`}
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th right>Qty</Th>
            <Th>Unit</Th>
            <Th right>Unit price</Th>
            <Th right>Net</Th>
          </tr>
        </thead>
        <tbody>
          {credit.lines.map((l) => (
            <tr key={l.id}>
              <Td mono>{l.product.sku}</Td>
              <Td>{l.product.name}</Td>
              <Td right>{l.quantity}</Td>
              <Td>{l.unitsPerUom > 1 ? `pack × ${l.unitsPerUom}` : "each"}</Td>
              <Td right>{formatPence(l.unitPricePence)}</Td>
              <Td right>{formatPence(l.quantity * l.unitPricePence)}</Td>
            </tr>
          ))}
        </tbody>
      </DocTable>
      <TotalsBlock
        rows={[
          { label: "Net", value: formatPence(credit.netPence) },
          { label: "VAT", value: formatPence(credit.vatPence) },
          { label: "Total credit", value: formatPence(credit.grossPence), strong: true },
        ]}
      />
    </PrintShell>
  );
}
