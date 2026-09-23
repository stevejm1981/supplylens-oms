import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { orderNetPence } from "@/lib/sales";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function SalesOrdersPage() {
  const orders = await db.salesOrder.findMany({
    orderBy: { reference: "desc" },
    include: {
      customer: { select: { name: true } },
      salesPerson: { select: { name: true } },
      warehouse: { select: { name: true } },
      channel: { select: { name: true } },
      lines: { include: { despatchLines: { select: { despatchedQty: true } } } },
      invoice: { select: { number: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Sales Orders"
        hint="The commercial documents. Fulfilment happens on despatch documents raised against each order, Draft → Open (despatching) → Invoiced."
      >
        <Button asChild>
          <Link href="/sales-orders/new">
            <Plus /> New sales order
          </Link>
        </Button>
      </PageHeader>

      {orders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No sales orders yet"
          description="Raise an order for a customer, their default salesperson and warehouse pre-fill."
        >
          <Button asChild>
            <Link href="/sales-orders/new">
              <Plus /> New sales order
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfilment</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="pr-6 text-right">Net total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => {
                  const net = orderNetPence(o.lines, o.shippingPence, o.taxTreatment);
                  const ordered = o.lines.reduce((s, l) => s + l.quantity, 0);
                  const despatched = o.lines.reduce(
                    (s, l) => s + l.despatchLines.reduce((x, d) => x + d.despatchedQty, 0),
                    0,
                  );
                  const fulfilment =
                    despatched === 0
                      ? "UNFULFILLED"
                      : despatched >= ordered
                        ? "FULFILLED"
                        : "PARTIAL";
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/sales-orders/${o.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {o.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{o.customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {o.channel?.name ?? "Manual"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{o.salesPerson.name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {dateFmt.format(o.orderDate)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={o.status} />
                          {o.isPreOrder ? (
                            <Badge className="border-transparent bg-violet-100 text-violet-800">
                              Pre
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {o.status === "DRAFT" ? (
                          <span className="text-xs text-muted-foreground">, </span>
                        ) : (
                          <StatusBadge status={fulfilment} />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {o.invoice?.number ?? ", "}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {formatPence(net)}
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
