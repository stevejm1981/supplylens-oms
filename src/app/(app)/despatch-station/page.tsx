import { db } from "@/lib/db";
import { getFefoBatches, makeFefoSuggester } from "@/lib/batches";
import { PageHeader } from "@/components/page-header";
import { Station } from "./station";

// Formatted ON the server and passed down as plain text, a client component
// formatting dates during SSR hydrates against the browser's own date tables,
// which can render "Sept" vs "Sep" and trip a hydration mismatch.
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });
const bbeFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

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
              batchTracked: true,
              uoms: { select: { code: true, barcode: true, unitsPerUom: true } },
            },
          },
        },
      },
      despatches: { include: { lines: true } },
    },
  });

  // FEFO "take lot" notes per line: one depleting pool per warehouse, walked
  // in queue order, so two queued orders never point at the same units.
  const trackedIds = new Set<string>();
  for (const o of orders) {
    for (const l of o.lines) {
      if (l.product.type !== "BUNDLE" && l.product.batchTracked) trackedIds.add(l.productId);
    }
  }
  const suggesters = new Map<string, ReturnType<typeof makeFefoSuggester>>();
  if (trackedIds.size > 0) {
    for (const warehouseId of new Set(orders.map((o) => o.warehouseId))) {
      suggesters.set(
        warehouseId,
        makeFefoSuggester(await getFefoBatches({ productIds: [...trackedIds], warehouseId })),
      );
    }
  }

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
        tags: o.tags,
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
            const outstanding = l.quantity - (planned.get(l.id) ?? 0);
            const batchNote =
              outstanding > 0 && l.product.type !== "BUNDLE" && l.product.batchTracked
                ? (suggesters.get(o.warehouseId)?.(l.productId, outstanding * l.unitsPerUom) ?? [])
                    .map(
                      (b) =>
                        `Take lot ${b.batchRef}${b.bestBefore ? ` (BBE ${bbeFmt.format(b.bestBefore)})` : ""} ×${b.quantity}`,
                    )
                    .join(", ")
                : "";
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
              outstanding,
              batchNote: batchNote || null,
              tags: l.tags,
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
        hint="The packing bench. Take the next order from the queue (or tick several and Print job list for one consolidated walk), print its pick list, scan each item to verify (wrong items are refused), pack with weights and the expected carriage cost, generate the label, and Confirm despatch. Stock, COGS, order status, and the accounting journal all update in that final click. The DPD label is mocked in this prototype; the production build prints a real one on your own account."
      />
      <Station queue={queue} />
    </div>
  );
}
