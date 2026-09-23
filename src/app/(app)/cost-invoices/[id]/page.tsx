import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { formatPence, formatPercent } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
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

const typeLabels: Record<string, string> = {
  FREIGHT: "Freight",
  DUTY: "Duty",
  INSURANCE: "Insurance",
  HANDLING: "Handling",
  OTHER: "Other",
};
const methodLabels: Record<string, string> = {
  VALUE: "line value",
  QUANTITY: "quantity",
  WEIGHT: "weight",
};

export default async function CostInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await db.costInvoice.findUnique({
    where: { id },
    include: {
      purchaseOrders: { include: { purchaseOrder: { select: { reference: true, id: true } } } },
      allocations: {
        include: {
          poLine: {
            include: {
              product: { select: { sku: true, name: true, weightGrams: true } },
              purchaseOrder: { select: { reference: true } },
            },
          },
        },
      },
    },
  });
  if (!invoice) notFound();

  const totalAllocated = invoice.allocations.reduce((s, a) => s + a.amountPence, 0);
  const basisTotal = invoice.allocations.reduce((s, a) => {
    const l = a.poLine;
    return (
      s +
      (invoice.allocationMethod === "VALUE"
        ? l.quantity * l.unitCostPence
        : invoice.allocationMethod === "QUANTITY"
          ? l.quantity
          : l.quantity * l.product.weightGrams)
    );
  }, 0);

  return (
    <div>
      <PageHeader
        title={invoice.reference}
        description={`${invoice.vendor} · ${typeLabels[invoice.type]} · ${formatPence(invoice.amountPence)} allocated by ${methodLabels[invoice.allocationMethod]}`}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Allocation breakdown,{" "}
            {invoice.purchaseOrders.map((j, i) => (
              <span key={j.purchaseOrderId}>
                {i > 0 ? ", " : ""}
                <Link
                  href={`/purchase-orders/${j.purchaseOrder.id}`}
                  className="font-mono text-sm text-primary hover:underline"
                >
                  {j.purchaseOrder.reference}
                </Link>
              </span>
            ))}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Line</TableHead>
                <TableHead>PO</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Basis</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="pr-6 text-right">Per unit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.allocations.map((a) => {
                const l = a.poLine;
                const basis =
                  invoice.allocationMethod === "VALUE"
                    ? l.quantity * l.unitCostPence
                    : invoice.allocationMethod === "QUANTITY"
                      ? l.quantity
                      : l.quantity * l.product.weightGrams;
                const basisDisplay =
                  invoice.allocationMethod === "VALUE"
                    ? formatPence(basis)
                    : invoice.allocationMethod === "QUANTITY"
                      ? `${basis} u`
                      : `${(basis / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} kg`;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="pl-6">
                      <div className="font-mono text-xs font-medium">{l.product.sku}</div>
                      <div className="text-xs text-muted-foreground">{l.product.name}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {l.purchaseOrder.reference}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {basisDisplay}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {basisTotal > 0 ? formatPercent(basis / basisTotal) : ", "}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPence(a.amountPence)}
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                      {formatPence(a.amountPence / l.quantity, 4)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-6 font-medium">Total</TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatPence(totalAllocated)}
                </TableCell>
                <TableCell className="pr-6" />
              </TableRow>
            </TableFooter>
          </Table>
          {totalAllocated !== invoice.amountPence ? (
            <p className="px-6 pt-3 text-sm text-destructive">
              Warning: allocations ({formatPence(totalAllocated)}) do not sum to the
              invoice amount ({formatPence(invoice.amountPence)}).
            </p>
          ) : (
            <p className="px-6 pt-3 text-xs text-muted-foreground">
              Allocations reconcile exactly to the invoice amount, no penny drift.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
