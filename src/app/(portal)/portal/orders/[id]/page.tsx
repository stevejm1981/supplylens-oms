import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { formatPence } from "@/lib/money";
import { orderTotalsPence } from "@/lib/sales";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequestReturnDialog } from "./request-return";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function PortalOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect("/portal/sign-in");
  const { id } = await params;

  const order = await db.salesOrder.findUnique({
    where: { id },
    include: {
      lines: { include: { product: true, despatchLines: true, returnLines: true } },
      despatches: { orderBy: { reference: "asc" } },
      invoice: true,
      deliveryLocation: { select: { name: true } },
    },
  });
  if (!order || order.customerId !== buyer.customerId) notFound();

  const totals = orderTotalsPence(order.lines, order.shippingPence, order.taxTreatment);
  const proforma = order.notes?.includes("PROFORMA") ?? false;
  const returnable = order.lines
    .map((l) => ({
      orderLineId: l.id,
      sku: l.product.sku,
      max:
        l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0) -
        l.returnLines.reduce((s, r) => s + r.quantity, 0),
    }))
    .filter((l) => l.max > 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{order.reference}</h1>
        <StatusBadge status={order.status} />
        {proforma && order.status === "DRAFT" ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
            Awaiting payment before despatch
          </span>
        ) : null}
        <span className="flex-1" />
        {returnable.length > 0 ? (
          <RequestReturnDialog orderId={order.id} lines={returnable} />
        ) : null}
      </div>

      <div className="grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Ordered</p>
          <p>{dateFmt.format(order.orderDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Deliver to</p>
          <p>{order.deliveryLocation?.name ?? "Your default address"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Your PO</p>
          <p>{order.customerPoNumber ?? "—"}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lines</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Item</TableHead>
                <TableHead className="text-right">Ordered</TableHead>
                <TableHead className="text-right">Despatched</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="pr-6 text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines.map((l) => {
                const despatched = l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0);
                return (
                  <TableRow key={l.id}>
                    <TableCell className="pl-6">
                      <span className="font-mono text-xs font-medium">{l.product.sku}</span>
                      {l.uomCode ? (
                        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{l.uomCode}</span>
                      ) : null}
                      <span className="block text-xs text-muted-foreground">{l.product.name}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.quantity}
                      {l.originalQty !== l.quantity ? (
                        <span className="block text-xs text-muted-foreground">
                          of {l.originalQty} requested
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{despatched}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPence(l.unitPricePence)}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {formatPence(Math.round(l.quantity * l.unitPricePence * (1 - l.discountPct / 100)))}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="grid justify-end gap-1 px-6 pt-3 text-sm">
            <div className="flex justify-between gap-12">
              <span className="text-muted-foreground">Net</span>
              <span className="tabular-nums">{formatPence(totals.netPence)}</span>
            </div>
            <div className="flex justify-between gap-12">
              <span className="text-muted-foreground">VAT</span>
              <span className="tabular-nums">{formatPence(totals.vatPence)}</span>
            </div>
            <div className="flex justify-between gap-12 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{formatPence(totals.grossPence)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.despatches.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Shipments</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {order.despatches.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs">{d.reference}</span>
                <StatusBadge status={d.status} />
                {d.shippingService ? <span className="text-muted-foreground">{d.shippingService}</span> : null}
                {d.trackingNumber ? (
                  <span className="font-mono text-xs">{d.trackingNumber}</span>
                ) : null}
                {d.despatchedAt ? (
                  <span className="text-xs text-muted-foreground">
                    shipped {dateFmt.format(d.despatchedAt)}
                  </span>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {order.invoice ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-mono text-xs font-semibold">{order.invoice.number}</span>
            <span className="tabular-nums">{formatPence(order.invoice.grossPence)}</span>
            {order.invoice.dueDate ? (
              <span className="text-muted-foreground">
                due {dateFmt.format(order.invoice.dueDate)}
              </span>
            ) : null}
            <StatusBadge
              status={
                order.invoice.paidAt
                  ? "PAID"
                  : order.invoice.dueDate && order.invoice.dueDate.getTime() < Date.now()
                    ? "OVERDUE"
                    : "UNPAID"
              }
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
