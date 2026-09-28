// Printable supplier return (RTV): goods going back to a supplier with the
// credit expected per line.

import { notFound } from "next/navigation";

import { db } from "@/lib/db";
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

export default async function PrintSupplierReturnPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, rtv] = await Promise.all([
    getPrintOrg(),
    db.supplierReturn.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        lines: { include: { product: true } },
      },
    }),
  ]);
  if (!rtv) notFound();
  const totalPence = rtv.lines.reduce((s, l) => s + l.quantity * l.unitCostPence, 0);

  return (
    <PrintShell
      org={org}
      docTitle="Supplier Return"
      reference={rtv.reference}
      parties={[
        {
          label: "Return to",
          body: [rtv.supplier.name, rtv.supplier.country, rtv.supplier.contactEmail]
            .filter(Boolean)
            .join("\n"),
        },
        { label: "From", body: [org.name, rtv.warehouse.name].filter(Boolean).join("\n") },
      ]}
      meta={[
        { label: "Status", value: rtv.status === "SENT" ? "Sent" : "Draft" },
        { label: "Sent", value: rtv.sentAt ? printDateFmt.format(rtv.sentAt) : null },
      ]}
      notes={rtv.reason}
      footNote={`Please issue a credit against ${rtv.reference}. Quantities are in base units (eaches).`}
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th right>Qty</Th>
            <Th right>Unit cost</Th>
            <Th right>Expected credit</Th>
          </tr>
        </thead>
        <tbody>
          {rtv.lines.map((l) => (
            <tr key={l.id}>
              <Td mono>{l.product.sku}</Td>
              <Td>{l.product.name}</Td>
              <Td right>{l.quantity}</Td>
              <Td right>{formatPence(l.unitCostPence)}</Td>
              <Td right>{formatPence(l.quantity * l.unitCostPence)}</Td>
            </tr>
          ))}
        </tbody>
      </DocTable>
      <TotalsBlock
        rows={[{ label: "Expected credit", value: formatPence(totalPence), strong: true }]}
      />
    </PrintShell>
  );
}
