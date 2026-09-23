import { UserRound } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { orderNetPence } from "@/lib/sales";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SalesPersonFormDialog } from "./salesperson-form";
import { deleteSalesPerson } from "./actions";

export default async function SalesPeoplePage() {
  const people = await db.salesPerson.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { customers: true, salesOrders: true } },
      salesOrders: {
        where: { OR: [{ status: "INVOICED" }, { dispatchedAt: { not: null } }] },
        include: { lines: true },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Salespeople"
        hint="Order owners. Every sales order carries one; customers can carry a default."
      >
        <SalesPersonFormDialog />
      </PageHeader>

      {people.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="No salespeople yet"
          description="Add the team, then set each customer's default owner."
        >
          <SalesPersonFormDialog />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Customers</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Sales (dispatched+)</TableHead>
                  <TableHead className="w-24 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((p) => {
                  const revenue = p.salesOrders.reduce(
                    (s, o) => s + orderNetPence(o.lines, o.shippingPence, o.taxTreatment),
                    0,
                  );
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6 font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email ?? ", "}</TableCell>
                      <TableCell className="text-right tabular-nums">{p._count.customers}</TableCell>
                      <TableCell className="text-right tabular-nums">{p._count.salesOrders}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPence(revenue)}</TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end gap-1">
                          <SalesPersonFormDialog salesPerson={p} />
                          <ConfirmDelete id={p.id} label="salesperson" action={deleteSalesPerson} />
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
