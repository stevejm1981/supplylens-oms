import { ArrowLeftRight } from "lucide-react";

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
import { NewTransferDialog } from "../adjustments/stock-doc-dialogs";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function TransfersPage() {
  const [transfers, products, warehouses, stockLevels] = await Promise.all([
    db.warehouseTransfer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
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
        title="Warehouse transfers"
        hint="Move stock between warehouses in one step, the ledger records a paired out/in under the same reference, and per-warehouse availability recalculates instantly."
      >
        <NewTransferDialog products={products} warehouses={warehouses} levels={levels} />
      </PageHeader>
      <Card>
        <CardContent className="px-0">
          {transfers.length === 0 ? (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transfers yet"
              description="Rebalance stock between warehouses, both sides move in one transaction."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>Lines</TableHead>
                  <TableHead className="pr-6 text-right">Units moved</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-6 font-mono text-xs font-medium">
                      {t.reference}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dateFmt.format(t.createdAt)}
                    </TableCell>
                    <TableCell>
                      {t.fromWarehouse.name}
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      {t.toWarehouse.name}
                      {t.notes ? (
                        <span className="block text-xs text-muted-foreground">{t.notes}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {t.lines.map((l) => (
                        <span
                          key={l.id}
                          className="mr-2 inline-block whitespace-nowrap font-mono text-xs"
                        >
                          {l.product.sku} ×{l.quantity}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">
                      {t.lines.reduce((s, l) => s + l.quantity, 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
