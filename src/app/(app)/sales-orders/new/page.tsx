import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/page-header";
import { SoForm } from "./so-form";

export default async function NewSalesOrderPage() {
  const [customers, salespeople, warehouses, channels, products] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        defaultSalesPersonId: true,
        defaultWarehouseId: true,
        deliveryAddress: true,
        prices: { select: { productId: true, unitPricePence: true } },
        locations: {
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: {
            id: true,
            code: true,
            name: true,
            address: true,
            contact: true,
            isDefault: true,
          },
        },
      },
    }),
    db.salesPerson.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.channel.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      orderBy: { sku: "asc" },
      select: {
        id: true,
        sku: true,
        name: true,
        type: true,
        sellPricePence: true,
        uoms: {
          orderBy: { unitsPerUom: "asc" },
          select: { code: true, name: true, unitsPerUom: true },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="New sales order"
        hint="Pick the customer first, their default salesperson and warehouse pre-fill, but stay editable."
      />
      <SoForm
        customers={customers}
        salespeople={salespeople}
        warehouses={warehouses}
        channels={channels}
        products={products}
        defaultTaxTreatment={(await getSettings()).defaultTaxTreatment}
      />
    </div>
  );
}
