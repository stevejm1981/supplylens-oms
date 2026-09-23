import Link from "next/link";
import { FileText } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { PaidButton } from "./paid-button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function InvoicesPage() {
  const invoices = await db.invoice.findMany({
    orderBy: { number: "desc" },
    include: {
      salesOrder: {
        include: {
          customer: { select: { name: true } },
          salesPerson: { select: { name: true } },
        },
      },
    },
  });

  const totals = invoices.reduce(
    (acc, inv) => ({
      net: acc.net + inv.netPence,
      vat: acc.vat + inv.vatPence,
      gross: acc.gross + inv.grossPence,
    }),
    { net: 0, vat: 0, gross: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Invoices"
        hint="The invoice register, raised from dispatched sales orders. In a full build these push straight into QuickBooks."
      />

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Dispatch a sales order, then create its invoice, it lands here."
        />
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Number</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Salesperson</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="pr-6 text-right">Gross</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const paymentStatus = inv.paidAt
                    ? "PAID"
                    : inv.dueDate && inv.dueDate.getTime() < Date.now()
                      ? "OVERDUE"
                      : "UNPAID";
                  return (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-6 font-mono text-xs font-semibold">
                      {inv.number}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sales-orders/${inv.salesOrderId}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {inv.salesOrder.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{inv.salesOrder.customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.salesOrder.salesPerson.name}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dateFmt.format(inv.invoiceDate)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {inv.dueDate ? dateFmt.format(inv.dueDate) : ", "}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={paymentStatus} />
                        {inv.paidAt ? (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {dateFmt.format(inv.paidAt)}
                          </span>
                        ) : null}
                        <PaidButton id={inv.id} paid={Boolean(inv.paidAt)} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPence(inv.netPence)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatPence(inv.vatPence)}
                    </TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">
                      {formatPence(inv.grossPence)}
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium" colSpan={7}>
                    Totals
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPence(totals.net)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPence(totals.vat)}</TableCell>
                  <TableCell className="pr-6 text-right font-semibold tabular-nums">
                    {formatPence(totals.gross)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
