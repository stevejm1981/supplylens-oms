import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getTranchesByProduct } from "@/lib/queries";
import { movementTypeLabels } from "@/lib/stock-ledger";

const moveDateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
import { computeAvgLandedCost } from "@/lib/engine/average-cost";
import { formatGrams, formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { ProductFormDialog } from "../product-form";
import { UomsCard } from "./uoms-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [product, tranchesByProduct, movements, suppliers, families, categories, brands] =
    await Promise.all([
    db.product.findUnique({
      where: { id },
      include: {
        supplier: true,
        category: true,
        brand: true,
        stockLevels: { include: { warehouse: true }, orderBy: { warehouse: { name: "asc" } } },
        bomLines: { include: { component: true } },
        family: { include: { products: { orderBy: { sku: "asc" } } } },
        uoms: { orderBy: { unitsPerUom: "asc" } },
      },
    }),
    getTranchesByProduct(),
    db.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { warehouse: { select: { name: true } } },
    }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.productFamily.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!product) notFound();

  const tranches = tranchesByProduct.get(product.id) ?? [];
  const avg = computeAvgLandedCost(tranches);
  const onHand = product.stockLevels.reduce((s, l) => s + l.quantity, 0);

  return (
    <div>
      <PageHeader title={product.sku} description={product.name}>
        {product.type === "BUNDLE" ? (
          <Badge variant="secondary">Bundle</Badge>
        ) : (
          <Badge variant="outline">Standard</Badge>
        )}
        <ProductFormDialog
          product={product}
          suppliers={suppliers}
          families={families}
          categories={categories}
          brands={brands}
          triggerLabel="Edit product"
        />
      </PageHeader>

      {product.family ? (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {product.family.name}
          </span>
          <span className="text-muted-foreground/40">·</span>
          {product.family.products.map((sibling) =>
            sibling.id === product.id ? (
              <Badge key={sibling.id} className="border-transparent bg-primary text-primary-foreground">
                {sibling.variant ?? sibling.sku}
              </Badge>
            ) : (
              <Link key={sibling.id} href={`/products/${sibling.id}`}>
                <Badge
                  variant="outline"
                  className="transition-colors hover:border-primary hover:text-primary"
                >
                  {sibling.variant ?? sibling.sku}
                </Badge>
              </Link>
            ),
          )}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt={product.name}
                className="mb-4 h-40 w-full rounded-lg border object-contain bg-muted/30 p-2"
              />
            ) : null}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Supplier</dt>
              <dd>{product.supplier?.name ?? ", "}</dd>
              <dt className="text-muted-foreground">Category</dt>
              <dd>{product.category?.name ?? ", "}</dd>
              <dt className="text-muted-foreground">Brand</dt>
              <dd>{product.brand?.name ?? ", "}</dd>
              <dt className="text-muted-foreground">Barcode</dt>
              <dd className="font-mono text-xs">{product.barcode ?? ", "}</dd>
              <dt className="text-muted-foreground">Weight</dt>
              <dd>{product.weightGrams > 0 ? formatGrams(product.weightGrams) : ", "}</dd>
              <dt className="text-muted-foreground">Base cost</dt>
              <dd className="tabular-nums">{formatPence(product.baseCostPence)}</dd>
              <dt className="text-muted-foreground">Sell price</dt>
              <dd className="tabular-nums">{formatPence(product.sellPricePence)}</dd>
              <dt className="text-muted-foreground">Avg landed cost</dt>
              <dd className="font-semibold tabular-nums">
                {avg != null ? formatPence(avg, 4) : ", "}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock by warehouse</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {product.type === "BUNDLE" ? (
              <p className="px-6 pb-2 text-sm text-muted-foreground">
                Bundles hold no physical stock, availability derives from{" "}
                <Link href={`/bundles/${product.id}`} className="text-primary hover:underline">
                  the BOM
                </Link>
                .
              </p>
            ) : product.stockLevels.length === 0 ? (
              <p className="px-6 pb-2 text-sm text-muted-foreground">No stock recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Warehouse</TableHead>
                    <TableHead className="pr-6 text-right">On hand</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.stockLevels.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="pl-6">{l.warehouse.name}</TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">{l.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-6 font-medium">Total</TableCell>
                    <TableCell className="pr-6 text-right font-semibold tabular-nums">
                      {onHand}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {product.type !== "BUNDLE" ? (
          <UomsCard
            productId={product.id}
            uoms={product.uoms.map((u) => ({
              id: u.id,
              code: u.code,
              name: u.name,
              unitsPerUom: u.unitsPerUom,
              barcode: u.barcode,
            }))}
          />
        ) : null}

        {product.type !== "BUNDLE" ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Landed cost tranches
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  opening stock + every received PO line at its landed unit cost,
                  recomputed live, so late cost invoices re-price the average
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {tranches.length === 0 ? (
                <p className="px-6 pb-2 text-sm text-muted-foreground">
                  No cost history yet, receive a PO with this product.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Source</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Landed unit cost</TableHead>
                      <TableHead className="pr-6 text-right">Tranche value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tranches.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="pl-6">{t.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{t.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPence(t.unitCostPence, 4)}
                        </TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">
                          {formatPence(t.quantity * t.unitCostPence)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="pl-6 font-medium">Weighted average</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {tranches.reduce((s, t) => s + t.quantity, 0)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {avg != null ? formatPence(avg, 4) : ", "}
                      </TableCell>
                      <TableCell className="pr-6 text-right font-semibold tabular-nums">
                        {formatPence(tranches.reduce((s, t) => s + t.quantity * t.unitCostPence, 0))}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Bill of materials</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {product.bomLines.length === 0 ? (
                <p className="px-6 pb-2 text-sm text-muted-foreground">
                  No components yet, build the BOM on the{" "}
                  <Link href={`/bundles/${product.id}`} className="text-primary hover:underline">
                    bundle page
                  </Link>
                  .
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Component</TableHead>
                      <TableHead className="pr-6 text-right">Qty per bundle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.bomLines.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="pl-6">
                          <span className="font-mono text-xs font-medium">{l.component.sku}</span>
                          <span className="ml-2 text-muted-foreground">{l.component.name}</span>
                        </TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">{l.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {movements.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">
                Stock movements
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  latest {movements.length} events,{" "}
                  <Link href="/movements" className="text-primary hover:underline">
                    full ledger
                  </Link>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Date</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Document</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="pr-6 text-right">Balance after</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="pl-6 tabular-nums text-muted-foreground">
                        {moveDateFmt.format(m.createdAt)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{m.warehouse.name}</TableCell>
                      <TableCell className="text-sm">
                        {movementTypeLabels[m.type] ?? m.type}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {m.reference}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium tabular-nums ${
                          m.quantity > 0 ? "text-emerald-700" : "text-rose-600"
                        }`}
                      >
                        {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {m.balanceAfter}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
