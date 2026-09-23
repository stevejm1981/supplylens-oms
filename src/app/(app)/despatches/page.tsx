import Link from "next/link";
import { Truck } from "lucide-react";

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

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function DespatchesPage() {
  const despatches = await db.despatch.findMany({
    orderBy: { reference: "desc" },
    include: {
      salesOrder: {
        include: {
          customer: { select: { name: true } },
          warehouse: { select: { name: true } },
          lines: { select: { id: true, productId: true } },
        },
      },
      lines: true,
    },
  });

  const openCount = despatches.filter((d) => d.status !== "DESPATCHED").length;

  return (
    <div>
      <PageHeader
        title="Despatches"
        hint="The fulfilment work queue. Each despatch is one shipment against a sales order, pick it, then despatch it with a tracking number."
        description={openCount > 0 ? `${openCount} awaiting pick or despatch` : undefined}
      />

      {despatches.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No despatches yet"
          description="Open a sales order and click Create despatch to start picking."
        />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="pr-6">Despatched</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {despatches.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="pl-6 font-mono text-xs font-semibold">
                      {d.reference}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sales-orders/${d.salesOrderId}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {d.salesOrder.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {d.salesOrder.customer.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.salesOrder.warehouse.name}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={d.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {d.lines.reduce((s, l) => s + l.quantity, 0)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {d.shippingService ?? ", "}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {d.trackingNumber ?? ", "}
                    </TableCell>
                    <TableCell className="pr-6 tabular-nums text-muted-foreground">
                      {d.despatchedAt ? dateFmt.format(d.despatchedAt) : ", "}
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
