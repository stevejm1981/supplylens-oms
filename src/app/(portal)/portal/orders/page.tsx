import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { formatPence } from "@/lib/money";
import { orderNetPence } from "@/lib/sales";
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

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function PortalOrdersPage() {
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect("/portal/sign-in");

  const orders = await db.salesOrder.findMany({
    where: { customerId: buyer.customerId },
    orderBy: { orderDate: "desc" },
    include: {
      lines: { include: { despatchLines: { select: { despatchedQty: true } } } },
    },
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-xl font-semibold">Your orders</h1>
      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Your PO</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Fulfilment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => {
                const ordered = o.lines.reduce((s, l) => s + l.quantity, 0);
                const despatched = o.lines.reduce(
                  (s, l) => s + l.despatchLines.reduce((x, d) => x + d.despatchedQty, 0),
                  0,
                );
                const fulfilment =
                  despatched === 0 ? "UNFULFILLED" : despatched >= ordered ? "FULFILLED" : "PARTIAL";
                return (
                  <TableRow key={o.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/portal/orders/${o.id}`}
                        className="font-mono text-xs font-semibold text-primary hover:underline"
                      >
                        {o.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dateFmt.format(o.orderDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.customerPoNumber ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPence(orderNetPence(o.lines, o.shippingPence, o.taxTreatment))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="pr-6">
                      {o.status !== "DRAFT" ? <StatusBadge status={fulfilment} /> : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
