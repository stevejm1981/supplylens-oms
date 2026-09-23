import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Station } from "./station";

// Formatted ON the server and passed down as plain text, a client component
// formatting dates during SSR hydrates against the browser's own date tables,
// which can render "Sept" vs "Sep" and trip a hydration mismatch.
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function DespatchStationPage() {
  const orders = await db.salesOrder.findMany({
    where: { status: { in: ["DRAFT", "OPEN"] } },
    orderBy: [{ requiredDate: "asc" }, { orderDate: "asc" }],
    include: {
      customer: { select: { name: true } },
      channel: { select: { name: true } },
      lines: {
        include: {
          product: {
            select: {
              sku: true,
              name: true,
              barcode: true,
              weightGrams: true,
              type: true,
              uoms: { select: { code: true, barcode: true, unitsPerUom: true } },
            },
          },
        },
      },
      despatches: { include: { lines: true } },
    },
  });

  const queue = orders
    .map((o) => {
      const planned = new Map<string, number>();
      const resumable = o.despatches.find((d) => d.status === "PICKING" || d.status === "PICKED");
      // The resumable despatch's own lines stay "outstanding" here, the
      // station resumes that document, so the queue must keep showing it.
      for (const d of o.despatches) {
        if (d.id === resumable?.id) continue;
        for (const l of d.lines) {
          planned.set(l.orderLineId, (planned.get(l.orderLineId) ?? 0) + l.quantity);
        }
      }
      return {
        id: o.id,
        reference: o.reference,
        customer: o.customer.name,
        channel: o.channel?.name ?? "Manual",
        isPreOrder: o.isPreOrder,
        requiredLabel: o.requiredDate ? dateFmt.format(o.requiredDate) : null,
        shippingService: o.shippingService,
        deliveryAddress: o.deliveryAddress,
        deliveryContact: o.deliveryContact,
        shippingInstructions: o.shippingInstructions,
        giftMessage: o.giftMessage,
        resumeStatus: resumable?.status ?? null,
        lines: o.lines
          .map((l) => {
            const uom = l.uomCode
              ? l.product.uoms.find((u) => u.code === l.uomCode)
              : null;
            return {
              orderLineId: l.id,
              sku: l.product.sku,
              name: l.product.name,
              isBundle: l.product.type === "BUNDLE",
              uomCode: l.uomCode,
              unitsPerUom: l.unitsPerUom,
              productBarcode: l.product.barcode,
              outerBarcode: uom?.barcode ?? null,
              unitWeightGrams: l.product.weightGrams * l.unitsPerUom,
              outstanding: l.quantity - (planned.get(l.id) ?? 0),
            };
          })
          .filter((l) => l.outstanding > 0),
      };
    })
    .filter((o) => o.lines.length > 0);

  return (
    <div>
      <PageHeader
        title="Despatch Station"
        hint="The warehouse-app POC: a packing-bench view of the exact same despatch documents the rest of the OMS uses. Pick with barcode scans (product EANs and outer/case GTINs both verify), pack with weights, generate a carrier label (mocked DPD, the real build calls DPD's shipping API on the customer's own account), and confirm. Everything downstream, stock, ledger, COGS, accounting journal, order status, happens through the standard despatch flow."
      />
      <Station queue={queue} />
    </div>
  );
}
