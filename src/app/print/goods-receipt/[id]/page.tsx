// Printable goods received note (GRN): what actually arrived on one
// delivery against a purchase order, including captured batches.

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

export default async function PrintGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [org, grn] = await Promise.all([
    getPrintOrg(),
    db.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: { include: { supplier: true, lines: true } },
        warehouse: true,
        lines: { include: { product: true, batch: true, poLine: true } },
      },
    }),
  ]);
  if (!grn) notFound();
  const po = grn.purchaseOrder;
  const anyBatch = grn.lines.some((l) => l.batch);

  return (
    <PrintShell
      org={org}
      docTitle="Goods Received Note"
      reference={grn.reference}
      parties={[
        {
          label: "Supplier",
          body: [po.supplier.name, po.supplier.country].filter(Boolean).join("\n"),
        },
        { label: "Received into", body: grn.warehouse.name },
      ]}
      meta={[
        { label: "Received", value: printDateFmt.format(grn.receivedAt) },
        { label: "Against PO", value: po.reference },
        { label: "Container", value: po.containerRef },
        { label: "PO status", value: po.status },
      ]}
      notes={grn.notes}
      footNote="Quantities are in base units (eaches)."
    >
      <DocTable>
        <thead>
          <tr>
            <Th>SKU</Th>
            <Th>Description</Th>
            <Th right>Ordered</Th>
            <Th right>Received</Th>
            {anyBatch ? <Th>Batch</Th> : null}
            {anyBatch ? <Th>Best before</Th> : null}
          </tr>
        </thead>
        <tbody>
          {grn.lines.map((l) => (
            <tr key={l.id}>
              <Td mono>{l.product.sku}</Td>
              <Td>{l.product.name}</Td>
              <Td right>{l.poLine.quantity}</Td>
              <Td right>{l.quantity}</Td>
              {anyBatch ? <Td mono>{l.batch?.batchRef ?? ""}</Td> : null}
              {anyBatch ? (
                <Td>{l.batch?.bestBefore ? printDateFmt.format(l.batch.bestBefore) : ""}</Td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </DocTable>
    </PrintShell>
  );
}
