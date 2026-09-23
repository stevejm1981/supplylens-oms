import { Building2 } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { getAvgLandedCosts } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WarehouseFormDialog } from "./warehouse-form";
import { deleteWarehouse } from "./actions";

export default async function WarehousesPage() {
  const [warehouses, avgCosts] = await Promise.all([
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      include: { stockLevels: true, _count: { select: { salesOrders: true } } },
    }),
    getAvgLandedCosts(),
  ]);

  return (
    <div>
      <PageHeader
        title="Warehouses"
        hint="Where stock lives. Receiving, dispatch and stock views all run against these, the default is pre-selected everywhere."
      >
        <WarehouseFormDialog />
      </PageHeader>

      {warehouses.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No warehouses yet"
          description="Add your first warehouse, the first one becomes the default automatically."
        >
          <WarehouseFormDialog />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">SKUs held</TableHead>
                  <TableHead className="text-right">Units on hand</TableHead>
                  <TableHead className="text-right">Stock value</TableHead>
                  <TableHead className="text-right">Sales orders</TableHead>
                  <TableHead className="w-24 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((w) => {
                  const units = w.stockLevels.reduce((s, l) => s + l.quantity, 0);
                  const value = w.stockLevels.reduce((s, l) => {
                    const avg = avgCosts.get(l.productId);
                    return s + (avg != null ? l.quantity * avg : 0);
                  }, 0);
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="pl-6 font-medium">
                        {w.name}
                        {w.isDefault ? (
                          <Badge variant="secondary" className="ml-2">
                            Default
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{w.code}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w.stockLevels.filter((l) => l.quantity > 0).length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{units}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPence(value)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {w._count.salesOrders}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end gap-1">
                          <WarehouseFormDialog warehouse={w} />
                          <ConfirmDelete id={w.id} label="warehouse" action={deleteWarehouse} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
