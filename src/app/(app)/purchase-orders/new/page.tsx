import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { PoForm } from "./po-form";

export default async function NewPurchaseOrderPage() {
  const [suppliers, products] = await Promise.all([
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { type: "STANDARD" },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, baseCostPence: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="New purchase order"
        hint="Choose the supplier, add lines (unit costs pre-fill from each product, override with the quoted price), and give orders sharing a container the same container ref so cost invoices can split across them later."
      />
      <PoForm suppliers={suppliers} products={products} />
    </div>
  );
}
