import Link from "next/link";
import { Container, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
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

export default async function PurchaseOrdersPage() {
  const pos = await db.purchaseOrder.findMany({
    orderBy: { reference: "desc" },
    include: {
      supplier: { select: { name: true } },
      lines: true,
      costInvoices: { include: { costInvoice: { select: { amountPence: true } } } },
      receipts: { select: { billedAt: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Purchase Orders"
        hint="Buying, one order per supplier: raise with New purchase order, Place order once the supplier confirms, then book deliveries in at the Goods-In Station (partial deliveries, batches) or with Receive all outstanding on the order. Give POs sharing a container the same container ref so one freight bill can split across them."
      >
        <Button asChild>
          <Link href="/purchase-orders/new">
            <Plus /> New purchase order
          </Link>
        </Button>
      </PageHeader>

      {pos.length === 0 ? (
        <EmptyState
          icon={Container}
          title="No purchase orders yet"
          description="Raise a PO for your next container and receive it into stock."
        >
          <Button asChild>
            <Link href="/purchase-orders/new">
              <Plus /> New purchase order
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
                  <TableHead>Supplier</TableHead>
                  <TableHead>Container</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                  <TableHead className="text-right">Goods value</TableHead>
                  <TableHead className="pr-6 text-right">Allocated costs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pos.map((po) => {
                  const goods = po.lines.reduce(
                    (s, l) => s + l.quantity * l.unitCostPence,
                    0,
                  );
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {po.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{po.supplier.name}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {po.containerRef ?? ", "}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={po.status} />
                          {(() => {
                            const awaiting = po.receipts.filter((r) => !r.billedAt).length;
                            return awaiting > 0 ? (
                              <Badge className="border-transparent bg-amber-100 text-amber-800">
                                {awaiting} awaiting invoice
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {po.lines.length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(goods)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                        {po.costInvoices.length > 0
                          ? `${po.costInvoices.length} invoice${po.costInvoices.length > 1 ? "s" : ""}`
                          : ", "}
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
