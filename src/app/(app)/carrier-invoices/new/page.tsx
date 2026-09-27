import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { CarrierInvoiceForm, type DespatchOption } from "./invoice-form";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function NewCarrierInvoicePage() {
  const despatches = await db.despatch.findMany({
    where: { status: "DESPATCHED" },
    orderBy: { despatchedAt: "desc" },
    include: {
      salesOrder: {
        select: { reference: true, customer: { select: { name: true } } },
      },
      carrierAllocations: { select: { amountPence: true } },
    },
  });

  const options: DespatchOption[] = despatches.map((d) => ({
    id: d.id,
    reference: d.reference,
    orderRef: d.salesOrder.reference,
    customer: d.salesOrder.customer.name,
    service: d.shippingService,
    tracking: d.trackingNumber,
    despatchedLabel: d.despatchedAt ? dateFmt.format(d.despatchedAt) : "",
    expectedPence: d.expectedCarriagePence,
    invoicedPence: d.carrierAllocations.reduce((s, a) => s + a.amountPence, 0),
  }));

  return (
    <div>
      <PageHeader
        title="New carrier invoice"
        hint="Enter the carrier's invoice, one line per consignment, and pick the despatches each line covered. Consolidated consignments split by value, weight, equally, or by manual amounts. Matching books the variance against each despatch's accrued expected carriage; in your ledger app, code the carrier's bill to Carriage Accruals."
      />
      <CarrierInvoiceForm despatches={options} />
    </div>
  );
}
