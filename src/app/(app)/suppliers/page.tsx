import { Factory } from "lucide-react";

import { db } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { SupplierFormDialog } from "./supplier-form";
import { deleteSupplier } from "./actions";

export default async function SuppliersPage() {
  const suppliers = await db.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, purchaseOrders: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        hint="Who you buy from, the parties behind your purchase orders."
      >
        <SupplierFormDialog />
      </PageHeader>

      {suppliers.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="No suppliers yet"
          description="Add your first supplier to start raising purchase orders."
        >
          <SupplierFormDialog />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead className="text-right">Lead time</TableHead>
                  <TableHead className="text-right">Products</TableHead>
                  <TableHead className="text-right">POs</TableHead>
                  <TableHead className="w-24 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="pl-6 font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell>{s.country}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.leadTimeDays != null ? `${s.leadTimeDays}d` : ", "}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s._count.products}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s._count.purchaseOrders}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-1">
                        <SupplierFormDialog supplier={s} />
                        <ConfirmDelete id={s.id} label="supplier" action={deleteSupplier} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
