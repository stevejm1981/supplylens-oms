import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Container,
  Package,
  PackageX,
  Radio,
  Receipt,
  ShoppingCart,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";

import { db } from "@/lib/db";
import { getAvgLandedCosts, getStockByProduct } from "@/lib/queries";
import { lastMonths, sumByMonth } from "@/lib/engine/monthly";
import { effectiveCarriagePence } from "@/lib/engine/carriage";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
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
import { MonthlyChart, type MonthPoint } from "./monthly-chart";

export default async function DashboardPage() {
  const now = new Date();
  const months = lastMonths(12, now);
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    avgCosts,
    stock,
    physicalProducts,
    bundleCount,
    channelCount,
    orderCount,
    openOrders,
    customerCount,
    openPos,
    recentPos,
    soldAgg,
    invoices,
    credits,
    despatches,
  ] = await Promise.all([
    getAvgLandedCosts(),
    getStockByProduct(),
    db.product.findMany({ where: { type: { not: "BUNDLE" } }, select: { id: true } }),
    db.product.count({ where: { type: "BUNDLE" } }),
    db.channel.count(),
    db.salesOrder.count(),
    db.salesOrder.count({ where: { status: { in: ["DRAFT", "OPEN"] } } }),
    db.customer.count(),
    db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "PLACED", "PARTIALLY_RECEIVED"] } } }),
    db.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { supplier: { select: { name: true } }, lines: true },
    }),
    db.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { type: "DESPATCH", createdAt: { gte: windowStart } },
    }),
    db.invoice.findMany({
      where: { invoiceDate: { gte: windowStart } },
      select: { invoiceDate: true, netPence: true },
    }),
    db.creditNote.findMany({
      where: { creditDate: { gte: windowStart } },
      select: { creditDate: true, netPence: true },
    }),
    db.despatch.findMany({
      where: { status: "DESPATCHED", despatchedAt: { gte: windowStart } },
      select: {
        despatchedAt: true,
        expectedCarriagePence: true,
        lines: { select: { despatchedQty: true, unitCogsPence: true } },
        carrierAllocations: { select: { amountPence: true } },
      },
    }),
  ]);

  // Stock truth: total units on hand, what they are worth, and how many
  // physical products have nothing left to sell.
  let stockValue = 0;
  let stockUnits = 0;
  for (const [productId, qty] of stock) {
    stockUnits += qty;
    const avg = avgCosts.get(productId);
    if (avg != null) stockValue += qty * avg;
  }
  const outOfStock = physicalProducts.filter((p) => (stock.get(p.id) ?? 0) <= 0).length;
  const soldUnits = Math.abs(soldAgg._sum.quantity ?? 0);

  // Expense vs profit, month by month: invoiced revenue net of credits,
  // against COGS at landed cost plus carriage (cost to serve, actual once
  // the carrier invoiced, else the accrual).
  const revenueByMonth = sumByMonth(months, [
    ...invoices.map((i) => ({ date: i.invoiceDate, amountPence: i.netPence })),
    ...credits.map((c) => ({ date: c.creditDate, amountPence: -c.netPence })),
  ]);
  const expenseByMonth = sumByMonth(
    months,
    despatches.map((d) => ({
      date: d.despatchedAt!,
      amountPence:
        Math.round(d.lines.reduce((s, l) => s + l.despatchedQty * (l.unitCogsPence ?? 0), 0)) +
        effectiveCarriagePence(
          d.expectedCarriagePence,
          d.carrierAllocations.reduce((s, a) => s + a.amountPence, 0),
        ),
    })),
  );
  const chartPoints: MonthPoint[] = months.map((m, i) => ({
    label: m.label,
    revenuePence: revenueByMonth[i],
    expensePence: expenseByMonth[i],
    profitPence: revenueByMonth[i] - expenseByMonth[i],
  }));
  const revenue12m = revenueByMonth.reduce((s, v) => s + v, 0);
  const expense12m = expenseByMonth.reduce((s, v) => s + v, 0);
  const profit12m = revenue12m - expense12m;

  const kpis = [
    {
      label: "Inventory value @ landed cost",
      value: formatPence(stockValue),
      sub: `${stockUnits.toLocaleString("en-GB")} units on hand`,
      icon: Warehouse,
      href: "/stock",
    },
    {
      label: "Products",
      value: physicalProducts.length.toLocaleString("en-GB"),
      sub: `${bundleCount} bundles · ${channelCount} channels`,
      icon: Package,
      href: "/products",
    },
    {
      label: "Sales orders",
      value: orderCount.toLocaleString("en-GB"),
      sub: `${openOrders} open`,
      icon: ShoppingCart,
      href: "/sales-orders",
    },
    {
      label: "Customers",
      value: customerCount.toLocaleString("en-GB"),
      icon: Users,
      href: "/customers",
    },
    {
      label: "Out of stock",
      value: outOfStock.toLocaleString("en-GB"),
      sub: "physical products at zero or oversold",
      icon: PackageX,
      href: "/stock",
    },
    {
      label: "Units sold, 12 months",
      value: soldUnits.toLocaleString("en-GB"),
      sub: "despatched eaches from the ledger",
      icon: Truck,
      href: "/movements",
    },
    {
      label: "Open purchase orders",
      value: String(openPos),
      icon: Container,
      href: "/purchase-orders",
    },
    {
      label: "Profit, 12 months",
      value: formatPence(profit12m),
      sub: `${formatPence(revenue12m)} invoiced · ${formatPence(expense12m)} costs`,
      icon: Receipt,
      href: "/reports",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        hint="The whole operation at a glance: what the stock is worth, what is selling, what is missing, and twelve months of expense vs profit so the ebb and flow of the trading year is visible. Every number derives live from the ledger and documents, nothing here is a stored counter that can drift."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="group">
            <Card className="transition-shadow group-hover:shadow-md">
              <CardContent className="flex items-start justify-between gap-3 pt-1">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
                    {kpi.value}
                  </p>
                  {kpi.sub ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{kpi.sub}</p>
                  ) : null}
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <kpi.icon className="size-4.5" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">
            Expense vs profit, last 12 months
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              invoiced revenue net of credits, against COGS at landed cost plus carriage
            </span>
          </CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: "var(--line-strong)" }} />
              Expenses
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: "var(--brand)" }} />
              Profit
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <MonthlyChart points={chartPoints} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recent purchase orders</CardTitle>
            <Link
              href="/purchase-orders"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              All POs <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Goods value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPos.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/purchase-orders/${po.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {po.reference}
                      </Link>
                    </TableCell>
                    <TableCell>{po.supplier.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={po.status} />
                    </TableCell>
                    <TableCell className="pr-6 text-right tabular-nums">
                      {formatPence(
                        po.lines.reduce((s, l) => s + l.quantity * l.unitCostPence, 0),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">The two-minute tour</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            {[
              {
                icon: Receipt,
                href: "/purchase-orders",
                text: "Open PO-0001, freight, duty and handling are spread across its lines, penny-exact.",
              },
              {
                icon: Warehouse,
                text: "Stock is valued at average landed cost, attach a new cost invoice and watch it re-price.",
                href: "/stock",
              },
              {
                icon: Boxes,
                href: "/bundles",
                text: "Bundles derive availability from components, no assembly step.",
              },
              {
                icon: Radio,
                href: "/channels",
                text: "Each channel has its own feed rules, Very holds back at ≤5 and quarters the quantity.",
              },
            ].map((item, i) => (
              <Link
                key={i}
                href={item.href}
                className="flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <item.icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item.text}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
