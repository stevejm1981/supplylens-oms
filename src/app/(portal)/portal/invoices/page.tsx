import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { formatPence } from "@/lib/money";
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

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function PortalInvoicesPage() {
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect("/portal/sign-in");

  const [invoices, credits] = await Promise.all([
    db.invoice.findMany({
      where: { salesOrder: { customerId: buyer.customerId } },
      orderBy: { invoiceDate: "desc" },
      include: { salesOrder: { select: { reference: true } } },
    }),
    db.creditNote.findMany({
      where: { salesOrder: { customerId: buyer.customerId } },
      orderBy: { creditDate: "desc" },
      include: { salesOrder: { select: { reference: true } } },
    }),
  ]);

  return (
    <div className="grid gap-6">
      <h1 className="text-xl font-semibold">Invoices &amp; credits</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoices</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Number</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="pr-6">Payment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="pl-6 font-mono text-xs font-semibold">{inv.number}</TableCell>
                  <TableCell className="font-mono text-xs">{inv.salesOrder.reference}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {dateFmt.format(inv.invoiceDate)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {inv.dueDate ? dateFmt.format(inv.dueDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPence(inv.grossPence)}</TableCell>
                  <TableCell className="pr-6">
                    <StatusBadge
                      status={
                        inv.paidAt
                          ? "PAID"
                          : inv.dueDate && inv.dueDate.getTime() < Date.now()
                            ? "OVERDUE"
                            : "UNPAID"
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {credits.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credit notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {credits.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-semibold">{c.number}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.salesOrder.reference}</span>
                <span className="text-muted-foreground">{c.reason ?? ""}</span>
                <span className="flex-1" />
                <span className="tabular-nums">{formatPence(c.grossPence)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
