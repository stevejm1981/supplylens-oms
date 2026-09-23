import { ClipboardEdit } from "lucide-react";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewAdjustmentDialog } from "./stock-doc-dialogs";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdjustmentsPage() {
  const [adjustments, products, warehouses, stockLevels] = await Promise.all([
    db.stockAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: { select: { name: true } },
        lines: { include: { product: { select: { sku: true } } } },
      },
    }),
    db.product.findMany({
      where: { type: "STANDARD" },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true },
    }),
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.stockLevel.findMany({ select: { productId: true, warehouseId: true, quantity: true } }),
  ]);
  const levels = Object.fromEntries(
    stockLevels.map((l) => [`${l.productId}|${l.warehouseId}`, l.quantity]),
  );

  return (
    <div>
      <PageHeader
        title="Stock adjustments"
        hint="Stocktake variances, damage and shrinkage, corrections applied instantly with a mandatory reason. Every line lands in the movement ledger, so an auditor can trace any balance back through its adjustments."
      >
        <NewAdjustmentDialog products={products} warehouses={warehouses} levels={levels} />
      </PageHeader>
      <Card>
        <CardContent className="px-0">
          {adjustments.length === 0 ? (
            <EmptyState
              icon={ClipboardEdit}
              title="No adjustments yet"
              description="Book a stocktake variance or write off damaged goods, the ledger records every line."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead className="pr-6 text-right">Net units</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((a) => {
                  const net = a.lines.reduce((s, l) => s + l.quantityDelta, 0);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 font-mono text-xs font-medium">
                        {a.reference}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {dateFmt.format(a.createdAt)}
                      </TableCell>
                      <TableCell>{a.warehouse.name}</TableCell>
                      <TableCell>
                        {a.reason}
                        {a.notes ? (
                          <span className="block text-xs text-muted-foreground">{a.notes}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.lines.map((l) => (
                          <span
                            key={l.id}
                            className="mr-2 inline-block whitespace-nowrap font-mono text-xs"
                          >
                            {l.product.sku}{" "}
                            <span
                              className={
                                l.quantityDelta > 0 ? "text-emerald-700" : "text-rose-600"
                              }
                            >
                              {l.quantityDelta > 0 ? `+${l.quantityDelta}` : l.quantityDelta}
                            </span>
                          </span>
                        ))}
                      </TableCell>
                      <TableCell
                        className={`pr-6 text-right font-medium tabular-nums ${
                          net > 0 ? "text-emerald-700" : net < 0 ? "text-rose-600" : ""
                        }`}
                      >
                        {net > 0 ? `+${net}` : net}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
