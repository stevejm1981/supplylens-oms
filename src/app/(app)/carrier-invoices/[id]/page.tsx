import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default async function CarrierInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await db.carrierInvoice.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          allocations: {
            include: {
              despatch: {
                include: {
                  salesOrder: {
                    select: { id: true, reference: true, customer: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!invoice) notFound();

  const total = invoice.lines.reduce((s, l) => s + l.amountPence, 0);

  return (
    <div>
      <PageHeader
        title={invoice.reference}
        description={`${invoice.carrier} · ${dateFmt.format(invoice.invoiceDate)}${invoice.notes ? ` · ${invoice.notes}` : ""}`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Charges matched to despatches
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              variance = actual charge minus the carriage accrued when the order shipped
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Consignment</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Accrued</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="pr-6 text-right">Variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.lines.flatMap((l) =>
                l.allocations.map((a, i) => {
                  const expected = a.despatch.expectedCarriagePence;
                  const variance = expected != null ? a.amountPence - expected : null;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6">
                        {i === 0 ? (
                          <>
                            <span className="font-mono text-xs font-medium">
                              {l.consignmentRef ?? ", "}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {l.description ?? ""}
                              {l.allocations.length > 1
                                ? ` (split across ${l.allocations.length} orders)`
                                : ""}
                            </span>
                          </>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/sales-orders/${a.despatch.salesOrder.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {a.despatch.salesOrder.reference}
                        </Link>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">
                          {a.despatch.reference}
                        </span>
                      </TableCell>
                      <TableCell>{a.despatch.salesOrder.customer.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {expected != null ? formatPence(expected) : ", "}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(a.amountPence)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {variance == null ? (
                          <Badge variant="outline" className="text-muted-foreground">no accrual</Badge>
                        ) : variance === 0 ? (
                          <Badge variant="secondary">exact</Badge>
                        ) : (
                          <span className={`tabular-nums ${variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {variance > 0 ? "+" : ""}
                            {formatPence(variance)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                }),
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="pl-6 font-medium">
                  Invoice total
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatPence(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
