import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { db } from "@/lib/db";
import { landedUnitCostPence } from "@/lib/engine/landed-cost";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
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
import { PoActions } from "./po-actions";

const COST_TYPES = ["FREIGHT", "DUTY", "INSURANCE", "HANDLING", "OTHER"] as const;
const typeLabels: Record<string, string> = {
  FREIGHT: "Freight",
  DUTY: "Duty",
  INSURANCE: "Insurance",
  HANDLING: "Handling",
  OTHER: "Other",
};
const typeTint: Record<string, string> = {
  FREIGHT: "text-cyan-700",
  DUTY: "text-amber-700",
  INSURANCE: "text-violet-700",
  HANDLING: "text-emerald-700",
  OTHER: "text-rose-700",
};

export default async function PurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [po, warehouses] = await Promise.all([
    db.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        lines: { include: { product: true, allocations: { include: { costInvoice: true } } } },
        costInvoices: { include: { costInvoice: true } },
        reservations: {
          where: { status: { in: ["PENDING", "ACTIVE"] } },
          include: {
            product: { select: { sku: true } },
            salesOrder: { select: { id: true, reference: true } },
            customer: { select: { name: true } },
          },
        },
      },
    }),
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
  ]);
  if (!po) notFound();

  // Which cost types actually have allocations on this PO, drives the columns.
  const presentTypes = COST_TYPES.filter((t) =>
    po.lines.some((l) => l.allocations.some((a) => a.costInvoice.type === t)),
  );

  const goodsTotal = po.lines.reduce((s, l) => s + l.quantity * l.unitCostPence, 0);
  const allocatedTotal = po.lines.reduce(
    (s, l) => s + l.allocations.reduce((x, a) => x + a.amountPence, 0),
    0,
  );

  return (
    <div>
      <PageHeader
        title={po.reference}
        description={`${po.supplier.name}${po.containerRef ? ` · Container ${po.containerRef}` : ""}`}
      >
        <StatusBadge status={po.status} />
        <PoActions id={po.id} status={po.status} warehouses={warehouses} />
      </PageHeader>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lines & landed cost
              {presentTypes.length === 0 ? (
                <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  no cost invoices allocated yet, landed = base
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">SKU</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  {presentTypes.map((t) => (
                    <TableHead key={t} className={`text-right ${typeTint[t]}`}>
                      +{typeLabels[t]}
                    </TableHead>
                  ))}
                  <TableHead className="text-right font-semibold">Landed unit</TableHead>
                  <TableHead className="pr-6 text-right">Landed total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines.map((line) => {
                  const allocated = line.allocations.reduce((s, a) => s + a.amountPence, 0);
                  const landedUnit = landedUnitCostPence(
                    line.unitCostPence,
                    line.quantity,
                    allocated,
                  );
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="pl-6">
                        <div className="font-mono text-xs font-medium">
                          <Link href={`/products/${line.productId}`} className="text-primary hover:underline">
                            {line.product.sku}
                          </Link>
                        </div>
                        <div className="text-xs text-muted-foreground">{line.product.name}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(line.unitCostPence)}
                      </TableCell>
                      {presentTypes.map((t) => {
                        const amount = line.allocations
                          .filter((a) => a.costInvoice.type === t)
                          .reduce((s, a) => s + a.amountPence, 0);
                        return (
                          <TableCell
                            key={t}
                            className={`text-right tabular-nums ${typeTint[t]}`}
                          >
                            {amount > 0 ? formatPence(amount / line.quantity, 4) : ", "}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatPence(landedUnit, 4)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {formatPence(line.quantity * line.unitCostPence + allocated)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">Totals</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {po.lines.reduce((s, l) => s + l.quantity, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPence(goodsTotal)}</TableCell>
                  {presentTypes.map((t) => {
                    const amount = po.lines.reduce(
                      (s, l) =>
                        s +
                        l.allocations
                          .filter((a) => a.costInvoice.type === t)
                          .reduce((x, a) => x + a.amountPence, 0),
                      0,
                    );
                    return (
                      <TableCell key={t} className={`text-right tabular-nums ${typeTint[t]}`}>
                        {formatPence(amount)}
                      </TableCell>
                    );
                  })}
                  <TableCell />
                  <TableCell className="pr-6 text-right font-semibold tabular-nums">
                    {formatPence(goodsTotal + allocatedTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <Card>
          {po.reservations.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Waiting on this PO
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  holds that activate the instant the goods are received, back-order cover
                  links straight to its sales order
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1.5 text-sm">
                {po.reservations.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-2">
                    {r.salesOrder ? (
                      <Link
                        href={`/sales-orders/${r.salesOrder.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {r.salesOrder.reference}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs">{r.reference}</span>
                    )}
                    {r.customer ? <span>{r.customer.name}</span> : <span className="text-muted-foreground">general hold</span>}
                    <span className="font-mono text-xs">{r.product.sku}</span>
                    <span className="tabular-nums">×{r.quantity}</span>
                    <StatusBadge status={r.status === "PENDING" ? "AWAITING" : r.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <CardHeader>
            <CardTitle className="text-base">Cost invoices on this PO</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {po.costInvoices.length === 0 ? (
              <p className="px-6 pb-2 text-sm text-muted-foreground">
                None yet, attach freight, duty or handling from{" "}
                <Link href="/cost-invoices/new" className="text-primary hover:underline">
                  Cost invoices
                </Link>
                .
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Reference</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="pr-6 text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.costInvoices.map(({ costInvoice: inv }) => (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/cost-invoices/${inv.id}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {inv.reference}
                        </Link>
                      </TableCell>
                      <TableCell>{inv.vendor}</TableCell>
                      <TableCell className={typeTint[inv.type]}>
                        {typeLabels[inv.type] ?? inv.type}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {inv.allocationMethod.toLowerCase()}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {formatPence(inv.amountPence)}
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
