import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { InvoiceForm, type PoOption } from "./invoice-form";

export default async function NewCostInvoicePage() {
  const pos = await db.purchaseOrder.findMany({
    orderBy: { reference: "desc" },
    include: {
      supplier: { select: { name: true } },
      lines: { include: { product: { select: { sku: true, weightGrams: true } } } },
    },
  });

  const options: PoOption[] = pos.map((po) => ({
    id: po.id,
    reference: po.reference,
    supplierName: po.supplier.name,
    containerRef: po.containerRef,
    lines: po.lines.map((l) => ({
      id: l.id,
      sku: l.product.sku,
      quantity: l.quantity,
      unitCostPence: l.unitCostPence,
      unitWeightGrams: l.product.weightGrams,
    })),
  }));

  return (
    <div>
      <PageHeader
        title="New cost invoice"
        hint="Spread freight, duty or handling across one or more POs, split is penny-exact by design."
      />
      <InvoiceForm pos={options} />
    </div>
  );
}
