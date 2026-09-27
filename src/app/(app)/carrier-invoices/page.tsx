import Link from "next/link";
import { Plus, Truck } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
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
import { deleteCarrierInvoice } from "./actions";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function CarrierInvoicesPage() {
  const invoices = await db.carrierInvoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lines: {
        include: {
          allocations: {
            include: {
              despatch: {
                select: { reference: true, salesOrder: { select: { reference: true } } },
              },
            },
          },
        },
      },
    },
  });

  return (
    <div>
      <PageHeader
        title="Carrier Invoices"
        hint="What carriers charge YOU for outbound deliveries, matched to the orders they delivered. Enter an expected carriage cost when you despatch, then book the carrier's bill here with New carrier invoice: every order shows whether the carrier has billed it yet, the variance against what you expected, and a true margin with carriage netted off. One consignment covering several orders splits by value, weight, or manual amounts."
      >
        <Button asChild>
          <Link href="/carrier-invoices/new">
            <Plus /> New carrier invoice
          </Link>
        </Button>
      </PageHeader>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No carrier invoices yet"
          description="Match your first carrier bill to its despatches to see cost to serve and true margin per order."
        >
          <Button asChild>
            <Link href="/carrier-invoices/new">
              <Plus /> New carrier invoice
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
                  <TableHead>Carrier</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Orders covered</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-16 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => {
                  const total = inv.lines.reduce((s, l) => s + l.amountPence, 0);
                  const orders = [
                    ...new Set(
                      inv.lines.flatMap((l) =>
                        l.allocations.map((a) => a.despatch.salesOrder.reference),
                      ),
                    ),
                  ];
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/carrier-invoices/${inv.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {inv.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{inv.carrier}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {dateFmt.format(inv.invoiceDate)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {orders.slice(0, 4).join(", ")}
                        {orders.length > 4 ? ` +${orders.length - 4}` : ""}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPence(total)}</TableCell>
                      <TableCell className="pr-6 text-right">
                        <ConfirmDelete id={inv.id} label="carrier invoice" action={deleteCarrierInvoice} />
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
