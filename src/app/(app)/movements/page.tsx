import { db } from "@/lib/db";
import { movementTypeLabels } from "@/lib/stock-ledger";
import { PageHeader } from "@/components/page-header";
import { MovementsTable, type MovementRow } from "./movements-table";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function hrefFor(type: string, referenceId: string | null): string | null {
  if (!referenceId) return null;
  if (type === "PO_RECEIPT") return `/purchase-orders/${referenceId}`;
  if (type === "DESPATCH" || type === "CREDIT_RESTOCK" || type === "CUSTOMER_RETURN") {
    return `/sales-orders/${referenceId}`;
  }
  return null;
}

export default async function MovementsPage() {
  const [movements, warehouses] = await Promise.all([
    db.stockMovement.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { name: true } },
      },
    }),
    db.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const rows: MovementRow[] = movements.map((m) => ({
    id: m.id,
    when: dateFmt.format(m.createdAt),
    sku: m.product.sku,
    productId: m.productId,
    productName: m.product.name,
    warehouseId: m.warehouseId,
    warehouseName: m.warehouse.name,
    quantity: m.quantity,
    balanceAfter: m.balanceAfter,
    type: m.type,
    typeLabel: movementTypeLabels[m.type] ?? m.type,
    reference: m.reference,
    href: hrefFor(m.type, m.referenceId),
  }));

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        hint="The append-only ledger: every event that changed stock, the document that caused it, and the running balance after, written in the same transaction as the change."
        description={`Last ${rows.length} events, newest first`}
      />
      <MovementsTable
        rows={rows}
        warehouses={warehouses}
        types={Object.entries(movementTypeLabels).map(([value, label]) => ({ value, label }))}
      />
    </div>
  );
}
