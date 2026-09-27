import { db } from "@/lib/db";
import { receiptProgress } from "@/lib/engine/fefo";
import { PageHeader } from "@/components/page-header";
import { GoodsInStation, type InboundPo } from "./station";

// Dates formatted ON the server, passed as strings (hydration-safe).
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function GoodsInStationPage() {
  const [pos, warehouses] = await Promise.all([
    db.purchaseOrder.findMany({
      where: { status: { in: ["PLACED", "PARTIALLY_RECEIVED"] } },
      orderBy: [{ expectedDate: "asc" }, { placedAt: "asc" }],
      include: {
        supplier: { select: { name: true } },
        lines: {
          include: {
            product: { select: { sku: true, name: true, barcode: true, batchTracked: true } },
          },
        },
        receipts: { include: { lines: true } },
      },
    }),
    db.warehouse.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
  ]);

  const queue: InboundPo[] = pos
    .map((po) => {
      const progress = receiptProgress(
        po.lines.map((l) => ({ id: l.id, quantity: l.quantity })),
        po.receipts.flatMap((r) =>
          r.lines.map((x) => ({ poLineId: x.poLineId, quantity: x.quantity })),
        ),
      );
      return {
        id: po.id,
        reference: po.reference,
        supplier: po.supplier.name,
        status: po.status,
        expectedLabel: po.expectedDate ? dateFmt.format(po.expectedDate) : null,
        containerRef: po.containerRef,
        deliveries: po.receipts.length,
        lines: po.lines
          .map((l) => ({
            poLineId: l.id,
            sku: l.product.sku,
            name: l.product.name,
            barcode: l.product.barcode,
            batchTracked: l.product.batchTracked,
            ordered: l.quantity,
            received: progress.receivedByLine.get(l.id) ?? 0,
            outstanding: progress.outstandingByLine.get(l.id) ?? 0,
          }))
          .filter((l) => l.outstanding > 0),
      };
    })
    .filter((po) => po.lines.length > 0);

  return (
    <div>
      <PageHeader
        title="Goods-In Station"
        hint="The receiving-door view: open the delivery's purchase order, scan or tap each product, enter what actually arrived, and record the batch and best-before where the product demands one. Deliveries that arrive in parts are received in parts; the order walks Placed, Part received, Received on its own. Every receipt moves stock inside a ledgered transaction and puts exactly this delivery's value on the balance sheet."
      />
      <GoodsInStation
        queue={queue}
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, isDefault: w.isDefault }))}
      />
    </div>
  );
}
