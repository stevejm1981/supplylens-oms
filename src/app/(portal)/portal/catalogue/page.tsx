// The buyer's catalogue: every sellable product at THEIR price, stock shown
// as bands, packs orderable as units. Prices resolve server side here for
// display, and again at order time, the basket never carries a price.

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { getAvailableEffectiveStockMap } from "@/lib/queries";
import { resolveUnitPrice, stockBand } from "@/lib/engine/pricing";
import { Catalogue } from "./catalogue-client";

export default async function CataloguePage() {
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect("/portal/sign-in");

  const [products, customer, available] = await Promise.all([
    db.product.findMany({
      where: { sellPricePence: { gt: 0 } },
      orderBy: { sku: "asc" },
      include: { uoms: { orderBy: { unitsPerUom: "asc" } } },
    }),
    db.customer.findUniqueOrThrow({
      where: { id: buyer.customerId },
      include: { prices: true, locations: { orderBy: [{ isDefault: "desc" }, { name: "asc" }] } },
    }),
    getAvailableEffectiveStockMap(),
  ]);
  const priceById = new Map(customer.prices.map((p) => [p.productId, p.unitPricePence]));

  return (
    <Catalogue
      proforma={buyer.paymentTermsDays === 0}
      locations={customer.locations.map((l) => ({
        id: l.id,
        name: l.name,
        isDefault: l.isDefault,
      }))}
      items={products.map((p) => {
        const listed = priceById.get(p.id) ?? null;
        return {
          productId: p.id,
          sku: p.sku,
          name: p.name,
          imageUrl: p.imageUrl,
          band: stockBand(available.get(p.id) ?? 0),
          listPriced: listed != null,
          eachPricePence: resolveUnitPrice({
            customerPricePence: listed,
            sellPricePence: p.sellPricePence,
          }),
          uoms: p.uoms.map((u) => ({
            code: u.code,
            name: u.name,
            unitsPerUom: u.unitsPerUom,
            pricePence: resolveUnitPrice({
              customerPricePence: listed,
              sellPricePence: p.sellPricePence,
              unitsPerUom: u.unitsPerUom,
            }),
          })),
        };
      })}
    />
  );
}
