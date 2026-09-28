// Printable purchase order, the paper a supplier receives.

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

export default async function PrintPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, po] = await Promise.all([
    getPrintOrg(),
    db.purchaseOrder.findUnique({
      where: { id },
      include: { supplier: true, lines: { include: { product: true } } },
    }),
  ]);
  if (!po) notFound();
  const totalPence = po.lines.reduce((s, l) => s + l.quantity * l.unitCostPence, 0);

  return (
    <PrintShell
      org={org}
      docTitle="Purchase Order"
      reference={po.reference}
      parties={[
        {
          label: "Supplier",
          body: [po.supplier.name, po.supplier.country, po.supplier.contactEmail]
            .filter(Boolean)
            .join("\n"),
        },
        {
          label: "Deliver to",
          body: [org.name, org.addressBlock].filter(Boolean).join("\n"),
        },
      ]}
      meta={[
        { label: "Status", value: po.status },
        { label: "Placed", value: po.placedAt ? printDateFmt.format(po.placedAt) : null },
        { label: "Expected", value: po.expectedDate ? printDateFmt.format(po.expectedDate) : null },
        { label: "Container", value: po.containerRef },
        { label: "Currency", value: po.currency },
        {
          label: "Lead time",
          value: po.supplier.leadTimeDays ? `${po.supplier.leadTimeDays} days` : null,
        },
      ]}
      notes={po.notes}
      footNote={`Please quote ${po.reference} on all correspondence, delivery notes, and invoices.`}
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th>Barcode</Th>
            <Th right>Qty</Th>
            <Th right>Unit cost</Th>
            <Th right>Total</Th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((l) => (
            <tr key={l.id}>
              <Td mono>{l.product.sku}</Td>
              <Td>{l.product.name}</Td>
              <Td mono>{l.product.barcode ?? ""}</Td>
              <Td right>{l.quantity}</Td>
              <Td right>{formatPence(l.unitCostPence)}</Td>
              <Td right>{formatPence(l.quantity * l.unitCostPence)}</Td>
            </tr>
          ))}
        </tbody>
      </DocTable>
      <TotalsBlock
        rows={[{ label: "Order total", value: formatPence(totalPence), strong: true }]}
      />
    </PrintShell>
  );
}
