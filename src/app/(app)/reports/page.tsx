import Link from "next/link";
import { BarChart3, PoundSterling, Receipt, ShoppingCart, TrendingUp } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { fillRates, formatFill, lineNetPence, orderNetPence } from "@/lib/sales";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const WINDOW_DAYS = 30;

export default async function ReportsPage() {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [orders, credits] = await Promise.all([
    db.salesOrder.findMany({
      where: { orderDate: { gte: since }, OR: [{ status: "INVOICED" }, { dispatchedAt: { not: null } }] },
      include: {
        customer: { select: { name: true } },
        salesPerson: { select: { name: true } },
        channel: { select: { name: true } },
        lines: {
          include: {
            product: { select: { sku: true, name: true } },
            despatchLines: { select: { despatchedQty: true } },
          },
        },
      },
    }),
    db.creditNote.findMany({
      where: { creditDate: { gte: since } },
      include: {
        lines: { include: { product: { select: { sku: true, name: true } } } },
        salesOrder: { select: { customerId: true, salesPersonId: true, channelId: true } },
        customerReturn: { include: { lines: true } },
      },
    }),
  ]);

  const lineNet = lineNetPence;

  const grossRevenue = orders.reduce(
    (s, o) => s + orderNetPence(o.lines, o.shippingPence, o.taxTreatment),
    0,
  );
  const creditedNet = credits.reduce((s, c) => s + c.netPence, 0);
  // COGS reverses only for goods physically back in stock: a manual restock
  // credit's lines, or an RMA credit's restocked quantities. Write-offs leave
  // the cost spent.
  const creditCogs = (c: (typeof credits)[number]) =>
    c.restock
      ? c.lines.reduce((x, l) => x + l.quantity * (l.unitCogsPence ?? 0), 0)
      : (c.customerReturn?.lines.reduce(
          (x, l) => x + l.restockQty * (l.unitCogsPence ?? 0),
          0,
        ) ?? 0);
  const creditedCogs = credits.reduce((s, c) => s + creditCogs(c), 0);

  const revenue = grossRevenue - creditedNet;
  const cogs =
    orders.reduce(
      (s, o) => s + o.lines.reduce((x, l) => x + l.quantity * (l.unitCogsPence ?? 0), 0),
      0,
    ) - creditedCogs;
  const margin = revenue - cogs;
  const orderCount = orders.length;
  const avgOrder = orderCount > 0 ? grossRevenue / orderCount : 0;

  // Top products by revenue.
  const byProduct = new Map<string, { sku: string; name: string; units: number; revenue: number }>();
  for (const o of orders) {
    for (const l of o.lines) {
      const entry = byProduct.get(l.productId) ?? {
        sku: l.product.sku,
        name: l.product.name,
        units: 0,
        revenue: 0,
      };
      entry.units += l.quantity * l.unitsPerUom; // base units so packs and eaches add up
      entry.revenue += lineNet(l);
      byProduct.set(l.productId, entry);
    }
  }
  for (const c of credits) {
    for (const l of c.lines) {
      const entry = byProduct.get(l.productId);
      if (entry) {
        entry.units -= l.quantity * l.unitsPerUom;
        entry.revenue -= lineNet(l);
      }
    }
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topProductMax = topProducts[0]?.revenue ?? 1;

  // Salesperson leaderboard.
  const bySalesPerson = new Map<string, { name: string; orders: number; revenue: number; margin: number }>();
  for (const o of orders) {
    const entry = bySalesPerson.get(o.salesPersonId) ?? {
      name: o.salesPerson.name,
      orders: 0,
      revenue: 0,
      margin: 0,
    };
    const net = orderNetPence(o.lines, o.shippingPence, o.taxTreatment);
    const oCogs = o.lines.reduce((x, l) => x + l.quantity * (l.unitCogsPence ?? 0), 0);
    entry.orders += 1;
    entry.revenue += net;
    entry.margin += net - oCogs;
    bySalesPerson.set(o.salesPersonId, entry);
  }
  for (const c of credits) {
    const entry = bySalesPerson.get(c.salesOrder.salesPersonId);
    if (entry) {
      entry.revenue -= c.netPence;
      entry.margin -= c.netPence - creditCogs(c);
    }
  }
  const leaderboard = [...bySalesPerson.values()].sort((a, b) => b.revenue - a.revenue);
  const leaderMax = leaderboard[0]?.revenue ?? 1;

  // Top customers.
  const byCustomer = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const o of orders) {
    const entry = byCustomer.get(o.customerId) ?? {
      name: o.customer.name,
      orders: 0,
      revenue: 0,
    };
    entry.orders += 1;
    entry.revenue += orderNetPence(o.lines, o.shippingPence, o.taxTreatment);
    byCustomer.set(o.customerId, entry);
  }
  for (const c of credits) {
    const entry = byCustomer.get(c.salesOrder.customerId);
    if (entry) entry.revenue -= c.netPence;
  }
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Sales by channel, where the orders came from (null = manual/wholesale).
  const byChannel = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const o of orders) {
    const key = o.channelId ?? "manual";
    const entry = byChannel.get(key) ?? {
      name: o.channel?.name ?? "Manual / wholesale",
      orders: 0,
      revenue: 0,
    };
    entry.orders += 1;
    entry.revenue += orderNetPence(o.lines, o.shippingPence, o.taxTreatment);
    byChannel.set(key, entry);
  }
  for (const c of credits) {
    const entry = byChannel.get(c.salesOrder.channelId ?? "manual");
    if (entry) entry.revenue -= c.netPence;
  }
  const channelBreakdown = [...byChannel.values()].sort((a, b) => b.revenue - a.revenue);
  const channelMax = channelBreakdown[0]?.revenue ?? 1;

  // Fill rates across the window, quantity-weighted, capped per line.
  const fill = fillRates(
    orders.flatMap((o) =>
      o.lines.map((l) => ({
        originalQty: l.originalQty,
        quantity: l.quantity,
        despatchedQty: l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0),
        unitsPerUom: l.unitsPerUom,
      })),
    ),
  );

  const kpis = [
    {
      label: `Sales (last ${WINDOW_DAYS} days, net of credits)`,
      value: formatPence(revenue),
      sub: creditedNet > 0 ? `less ${formatPence(creditedNet)} in ${credits.length} credits` : undefined,
      icon: PoundSterling,
    },
    { label: "Orders", value: String(orderCount), sub: `avg ${formatPence(avgOrder)}`, icon: ShoppingCart },
    {
      label: "Margin @ landed cost",
      value: formatPence(margin),
      sub: revenue > 0 ? `${((margin / revenue) * 100).toFixed(1)}% of sales` : undefined,
      icon: TrendingUp,
    },
    { label: "COGS @ landed cost", value: formatPence(cogs), icon: Receipt },
  ];

  return (
    <div>
      <PageHeader
        title="Reports"
        hint={`Sales made = dispatched + invoiced orders in the last ${WINDOW_DAYS} days. Margin uses the COGS snapshot taken at dispatch, average landed cost, not supplier price.`}
      />

      {orderCount === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No sales in the window yet"
          description="Dispatch some sales orders and this dashboard lights up."
        />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.label}>
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
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top 5 products by sales</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {topProducts.map((p) => (
                  <div key={p.sku}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span>
                        <span className="font-mono text-xs font-semibold">{p.sku}</span>
                        <span className="ml-2 text-muted-foreground">{p.name}</span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatPence(p.revenue)}
                        <span className="ml-2 text-xs text-muted-foreground">{p.units} u</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.max(4, (p.revenue / topProductMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Salesperson leaderboard</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {leaderboard.map((s, i) => (
                  <div key={s.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span>
                        <span className="mr-2 inline-flex size-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                          {i + 1}
                        </span>
                        <span className="font-medium">{s.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {s.orders} orders
                        </span>
                      </span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatPence(s.revenue)}
                        <span className="ml-2 text-xs text-emerald-700">
                          {s.revenue > 0 ? `${((s.margin / s.revenue) * 100).toFixed(0)}% mgn` : ""}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-chart-2"
                        style={{ width: `${Math.max(4, (s.revenue / leaderMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Sales by channel
                <span className="ml-4 text-xs font-normal text-muted-foreground">
                  Fill rates, confirmation {formatFill(fill.confirmation)} · dispatch vs
                  original {formatFill(fill.dispatchOriginal)} · vs confirmed{" "}
                  {formatFill(fill.dispatchConfirmed)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {channelBreakdown.map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                    <span>
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {c.orders} order{c.orders === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="whitespace-nowrap tabular-nums">
                      {formatPence(c.revenue)}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {revenue > 0 ? `${((c.revenue / revenue) * 100).toFixed(1)}%` : ""}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-chart-4"
                      style={{ width: `${Math.max(4, (c.revenue / channelMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                A channel is the integration an order came through (e.g. Mirakl Tesco).
                In production the sync sets it automatically.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top customers</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Customer</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Sales (net)</TableHead>
                    <TableHead className="pr-6 text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCustomers.map((c) => (
                    <TableRow key={c.name}>
                      <TableCell className="pl-6 font-medium">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.orders}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(c.revenue)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums text-muted-foreground">
                        {revenue > 0 ? `${((c.revenue / revenue) * 100).toFixed(1)}%` : ", "}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="px-6 pt-3 text-xs text-muted-foreground">
                All figures net of VAT. See{" "}
                <Link href="/invoices" className="text-primary hover:underline">
                  Invoices
                </Link>{" "}
                for the gross register.
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
