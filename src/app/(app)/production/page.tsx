import { Hammer } from "lucide-react";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BuildRowDelete,
  FinishBuildDialog,
  NewBuildDialog,
  StartBuildButton,
} from "./production-components";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function ProductionPage() {
  const [orders, buildable, warehouses, stockLevels] = await Promise.all([
    db.productionOrder.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { name: true } },
        lines: { include: { component: { select: { sku: true, name: true } } } },
      },
    }),
    db.product.findMany({
      where: { type: "ASSEMBLED" },
      orderBy: { sku: "asc" },
      include: {
        bomLines: { include: { component: { select: { sku: true, name: true } } } },
      },
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
        title="Production"
        hint="Build assembled products from their BOMs, three moments: Plan (parts list fills itself, availability shown green or red), Start (components leave stock into the build), Finish (say how many you made; extra parts and leftovers are handled honestly). Finished goods land in stock at their true rolled-up cost and every step is on the movement ledger."
      >
        <NewBuildDialog
          products={buildable.map((p) => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            bom: p.bomLines.map((b) => ({
              componentId: b.componentId,
              sku: b.component.sku,
              name: b.component.name,
              perUnit: b.quantity,
            })),
          }))}
          warehouses={warehouses}
          levels={levels}
        />
      </PageHeader>
      <Card>
        <CardContent className="px-0">
          {orders.length === 0 ? (
            <EmptyState
              icon={Hammer}
              title="No builds yet"
              description="Plan a build of an assembled product, the parts list comes from its BOM."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Making</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Made</TableHead>
                  <TableHead>Parts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead className="pr-6 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6 font-mono text-xs font-semibold">
                      {o.reference}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-medium">{o.product.sku}</span>
                      <span className="block text-xs text-muted-foreground">{o.product.name}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.warehouse.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{o.plannedQty}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {o.actualQty ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {o.lines.map((l) => (
                        <span key={l.id} className="mr-2 inline-block whitespace-nowrap font-mono">
                          {l.component.sku} ×{l.actualQty ?? l.plannedQty}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dateFmt.format(o.completedAt ?? o.startedAt ?? o.createdAt)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex justify-end gap-2">
                        {o.status === "DRAFT" ? (
                          <>
                            <StartBuildButton id={o.id} />
                            <BuildRowDelete id={o.id} />
                          </>
                        ) : o.status === "IN_PROGRESS" ? (
                          <FinishBuildDialog
                            id={o.id}
                            reference={o.reference}
                            productSku={o.product.sku}
                            plannedQty={o.plannedQty}
                            lines={o.lines.map((l) => ({
                              lineId: l.id,
                              sku: l.component.sku,
                              name: l.component.name,
                              plannedQty: l.plannedQty,
                            }))}
                          />
                        ) : null}
                      </div>
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
