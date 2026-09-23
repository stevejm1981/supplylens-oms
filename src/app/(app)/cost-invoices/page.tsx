import Link from "next/link";
import { Plus, Receipt } from "lucide-react";

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
import { deleteCostInvoice } from "./actions";

const typeLabels: Record<string, string> = {
  FREIGHT: "Freight",
  DUTY: "Duty",
  INSURANCE: "Insurance",
  HANDLING: "Handling",
  OTHER: "Other",
};

export default async function CostInvoicesPage() {
  const invoices = await db.costInvoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      purchaseOrders: { include: { purchaseOrder: { select: { reference: true } } } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Cost Invoices"
        hint="Freight, duty and other landed costs, allocated across purchase order lines."
      >
        <Button asChild>
          <Link href="/cost-invoices/new">
            <Plus /> New cost invoice
          </Link>
        </Button>
      </PageHeader>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No cost invoices yet"
          description="Attach your first freight or duty invoice to see landed costs come alive."
        >
          <Button asChild>
            <Link href="/cost-invoices/new">
              <Plus /> New cost invoice
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
                  <TableHead>Vendor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>POs</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-16 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/cost-invoices/${inv.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {inv.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{inv.vendor}</TableCell>
                    <TableCell>{typeLabels[inv.type] ?? inv.type}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {inv.allocationMethod.toLowerCase()}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {inv.purchaseOrders.map((j) => j.purchaseOrder.reference).join(", ")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPence(inv.amountPence)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <ConfirmDelete id={inv.id} label="cost invoice" action={deleteCostInvoice} />
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
