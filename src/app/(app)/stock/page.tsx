import Link from "next/link";
import { Boxes, Warehouse } from "lucide-react";

import { db } from "@/lib/db";
import {
  getAvailability,
  getAvailableEffectiveStockMap,
  getAvgLandedCosts,
} from "@/lib/queries";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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

export default async function StockPage() {
  const [levels, bundles, avgCosts, effective, availability] = await Promise.all([
    db.stockLevel.findMany({
      include: { product: true, warehouse: true },
      orderBy: [{ product: { sku: "asc" } }, { warehouse: { name: "asc" } }],
    }),
    db.product.findMany({
      where: { type: "BUNDLE" },
      orderBy: { sku: "asc" },
      include: { bomLines: { include: { component: true } } },
    }),
    getAvgLandedCosts(),
    getAvailableEffectiveStockMap(),
    getAvailability(),
  ]);

  const rows = levels.filter((l) => l.quantity !== 0 || l.openingQuantity !== 0);
  const totalValue = rows.reduce((s, l) => {
    const avg = avgCosts.get(l.productId);
    return s + (avg != null ? l.quantity * avg : 0);
  }, 0);

  return (
    <div>
      <PageHeader
        title="Stock"
        hint="Stock on hand across warehouses, valued at average landed cost."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="No stock yet"
          description="Receive a purchase order or seed opening stock to see positions here."
        />
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Physical stock</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Warehouse</TableHead>
                    <TableHead className="text-right">On hand</TableHead>
                    <TableHead className="text-right">Committed</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Avg landed cost</TableHead>
                    <TableHead className="pr-6 text-right">Stock value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((level) => {
                    const avg = avgCosts.get(level.productId) ?? null;
                    const a = availability.byProductWarehouse.get(
                      `${level.productId}|${level.warehouseId}`,
                    );
                    return (
                      <TableRow key={level.id}>
                        <TableCell className="pl-6">
                          <Link
                            href={`/products/${level.productId}`}
                            className="font-mono text-xs font-medium text-primary hover:underline"
                          >
                            {level.product.sku}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{level.product.name}</TableCell>
                        <TableCell className="text-muted-foreground">{level.warehouse.name}</TableCell>
                        <TableCell className="text-right tabular-nums">{level.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {a?.committed ?? 0}
                          {a && a.preOrdered > 0 ? (
                            <span className="ml-1 text-xs text-violet-600">
                              ({a.preOrdered} pre)
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {a?.reserved ?? 0}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium tabular-nums ${
                            (a?.available ?? 0) < 0 ? "text-rose-600" : ""
                          }`}
                        >
                          {a?.available ?? level.quantity}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {avg != null ? formatPence(avg, 2) : ", "}
                        </TableCell>
                        <TableCell className="pr-6 text-right tabular-nums">
                          {avg != null ? formatPence(level.quantity * avg) : ", "}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="pl-6 font-medium" colSpan={3}>
                      Total stock value at landed cost
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rows.reduce((s, l) => s + l.quantity, 0)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="pr-6 text-right font-semibold tabular-nums">
                      {formatPence(totalValue)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {bundles.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Boxes className="size-4 text-muted-foreground" />
                  Bundle availability (derived)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Bundle SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Components</TableHead>
                      <TableHead className="pr-6 text-right">Available</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundles.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="pl-6">
                          <Link
                            href={`/bundles/${b.id}`}
                            className="font-mono text-xs font-medium text-primary hover:underline"
                          >
                            {b.sku}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {b.bomLines
                            .map((l) => `${l.quantity}× ${l.component.sku}`)
                            .join(" · ") || "no BOM"}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <Badge variant="secondary" className="tabular-nums">
                            {effective.get(b.id) ?? 0}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="px-6 pt-3 text-xs text-muted-foreground">
                  Bundles are virtual, availability = the tightest component. Shared
                  components are counted by every bundle that uses them.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
