import Link from "next/link";
import { Undo2 } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
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

export default async function CreditsPage() {
  const credits = await db.creditNote.findMany({
    orderBy: { number: "desc" },
    include: {
      salesOrder: { include: { customer: { select: { name: true } } } },
      warehouse: { select: { name: true } },
    },
  });

  const totals = credits.reduce(
    (acc, c) => ({ net: acc.net + c.netPence, gross: acc.gross + c.grossPence }),
    { net: 0, gross: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Credits"
        hint="Credit notes raised against invoiced orders. Restocked credits return goods and reverse COGS; write-offs refund revenue only."
      />

      {credits.length === 0 ? (
        <EmptyState
          icon={Undo2}
          title="No credit notes yet"
          description="Open an invoiced sales order and click Create credit."
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
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="pr-6 text-right">Gross</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credits.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="pl-6 font-mono text-xs font-semibold">
                      {c.number}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/sales-orders/${c.salesOrderId}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {c.salesOrder.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.salesOrder.customer.name}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {dateFmt.format(c.creditDate)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.reason ?? ", "}</TableCell>
                    <TableCell>
                      {c.restock ? (
                        <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                          Restocked{c.warehouse ? ` → ${c.warehouse.name}` : ""}
                        </Badge>
                      ) : (
                        <Badge className="border-transparent bg-amber-100 text-amber-800">
                          Write-off
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      −{formatPence(c.netPence)}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      −{formatPence(c.grossPence)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium" colSpan={6}>
                    Totals
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    −{formatPence(totals.net)}
                  </TableCell>
                  <TableCell className="pr-6 text-right font-semibold tabular-nums">
                    −{formatPence(totals.gross)}
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
