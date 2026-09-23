import Link from "next/link";
import { RotateCcw } from "lucide-react";

import { db } from "@/lib/db";
import { getAvgLandedCosts } from "@/lib/queries";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NewSupplierReturnDialog,
  ReceiveRmaDialog,
  RmaRowActions,
  RtvRowActions,
} from "./return-components";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function ReturnsPage() {
  const [rmas, rtvs, suppliers, warehouses, products, avgCosts] = await Promise.all([
    db.customerReturn.findMany({
      orderBy: { reference: "desc" },
      include: {
        salesOrder: { include: { customer: { select: { name: true } } } },
        warehouse: { select: { name: true } },
        creditNote: { select: { number: true } },
        lines: { include: { orderLine: { include: { product: { select: { sku: true } } } } } },
      },
    }),
    db.supplierReturn.findMany({
      orderBy: { reference: "desc" },
      include: {
        supplier: { select: { name: true } },
        warehouse: { select: { name: true } },
        lines: { include: { product: { select: { sku: true } } } },
      },
    }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.product.findMany({
      where: { type: "STANDARD" },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true, supplierId: true },
    }),
    getAvgLandedCosts(),
  ]);

  const awaiting = rmas.filter((r) => r.status === "AWAITING").length;

  return (
    <div>
      <PageHeader
        title="Returns"
        hint="Customer returns (RMA) come back against sales orders, receive them with restock/write-off triage and the credit raises itself. Supplier returns (RTV) send goods back to vendors."
        description={awaiting > 0 ? `${awaiting} customer return${awaiting === 1 ? "" : "s"} awaiting receipt` : undefined}
      >
        <NewSupplierReturnDialog
          suppliers={suppliers}
          warehouses={warehouses}
          products={products.map((p) => ({
            ...p,
            avgLandedPence: avgCosts.get(p.id) ?? null,
          }))}
        />
      </PageHeader>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer returns (RMA)</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {rmas.length === 0 ? (
              <p className="px-6 pb-2 text-sm text-muted-foreground">
                None yet, book one from an order with despatched goods (the{" "}
                <b>Book return</b> button on the sales order).
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Reference</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lines (expected → restocked / written off)</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Credit</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rmas.map((rma) => (
                    <TableRow key={rma.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">
                        {rma.reference}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sales-orders/${rma.salesOrderId}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {rma.salesOrder.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {rma.salesOrder.customer.name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={rma.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rma.lines
                          .map((l) =>
                            rma.status === "RECEIVED"
                              ? `${l.orderLine.product.sku} ${l.quantity} → ${l.restockQty} / ${l.writeOffQty}`
                              : `${l.orderLine.product.sku} × ${l.quantity}`,
                          )
                          .join(" · ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{rma.reason ?? ", "}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rma.creditNote?.number ?? ", "}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {rma.status === "AWAITING" ? (
                            <>
                              <ReceiveRmaDialog
                                rmaId={rma.id}
                                reference={rma.reference}
                                lines={rma.lines.map((l) => ({
                                  id: l.id,
                                  sku: l.orderLine.product.sku,
                                  quantity: l.quantity,
                                }))}
                              />
                              <RmaRowActions rmaId={rma.id} />
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {rma.receivedAt ? dateFmt.format(rma.receivedAt) : ""} →{" "}
                              {rma.warehouse.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supplier returns (RTV)</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {rtvs.length === 0 ? (
              <EmptyState
                icon={RotateCcw}
                title="No supplier returns yet"
                description="Send damaged or overstocked goods back, stock leaves when marked sent."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Reference</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>From warehouse</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Expected credit</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rtvs.map((rtv) => (
                    <TableRow key={rtv.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">
                        {rtv.reference}
                      </TableCell>
                      <TableCell className="font-medium">{rtv.supplier.name}</TableCell>
                      <TableCell className="text-muted-foreground">{rtv.warehouse.name}</TableCell>
                      <TableCell>
                        {rtv.status === "SENT" ? (
                          <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                            Sent{rtv.sentAt ? ` ${dateFmt.format(rtv.sentAt)}` : ""}
                          </Badge>
                        ) : (
                          <StatusBadge status={rtv.status} />
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rtv.lines.map((l) => `${l.quantity}× ${l.product.sku}`).join(" · ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{rtv.reason ?? ", "}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(
                          rtv.lines.reduce((s, l) => s + l.quantity * l.unitCostPence, 0),
                        )}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end">
                          <RtvRowActions rtvId={rtv.id} status={rtv.status} />
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
    </div>
  );
}
