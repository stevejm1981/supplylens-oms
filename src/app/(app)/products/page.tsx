import { Package } from "lucide-react";

import { db } from "@/lib/db";
import { getAvgLandedCosts, getStockByProduct } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ProductFormDialog } from "./product-form";
import { NewGroupMenu } from "./taxonomy";
import { ProductsTable, type ProductRow } from "./products-table";

export default async function ProductsPage() {
  const [products, suppliers, families, categories, brands, avgCosts, stock] =
    await Promise.all([
      db.product.findMany({
        orderBy: { sku: "asc" },
        include: { supplier: true, family: true, category: true, brand: true },
      }),
      db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.productFamily.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
      getAvgLandedCosts(),
      getStockByProduct(),
    ]);

  const rows: ProductRow[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    type: p.type,
    variant: p.variant,
    familyId: p.familyId,
    familyName: p.family?.name ?? null,
    supplierName: p.supplier?.name ?? null,
    supplierId: p.supplierId,
    barcode: p.barcode,
    weightGrams: p.weightGrams,
    baseCostPence: p.baseCostPence,
    sellPricePence: p.sellPricePence,
    avgLandedPence: avgCosts.get(p.id) ?? null,
    onHand: stock.get(p.id) ?? 0,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? null,
    brandId: p.brandId,
    brandName: p.brand?.name ?? null,
    imageUrl: p.imageUrl,
  }));

  return (
    <div>
      <PageHeader
        title="Products"
        hint="Your SKU catalogue, grouped by family with category and brand filters. Landed cost averages update live as cost invoices land."
      >
        <NewGroupMenu />
        <ProductFormDialog
          suppliers={suppliers}
          families={families}
          categories={categories}
          brands={brands}
        />
      </PageHeader>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add SKUs to buy, stock and feed to channels."
        >
          <ProductFormDialog
            suppliers={suppliers}
            families={families}
            categories={categories}
            brands={brands}
          />
        </EmptyState>
      ) : (
        <ProductsTable
          rows={rows}
          suppliers={suppliers}
          families={families}
          categories={categories}
          brands={brands}
        />
      )}
    </div>
  );
}
