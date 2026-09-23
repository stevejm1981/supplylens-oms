import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Container,
  Package,
  Radio,
  Receipt,
  Warehouse,
} from "lucide-react";

import { db } from "@/lib/db";
import { getAvgLandedCosts, getStockByProduct } from "@/lib/queries";
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

export default async function DashboardPage() {
  const [avgCosts, stock, openPos, recentPos, counts, invoiceAgg] = await Promise.all([
    getAvgLandedCosts(),
    getStockByProduct(),
    db.purchaseOrder.count({ where: { status: { in: ["DRAFT", "PLACED"] } } }),
    db.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { supplier: { select: { name: true } }, lines: true },
    }),
    Promise.all([
      db.product.count({ where: { type: "STANDARD" } }),
      db.product.count({ where: { type: "BUNDLE" } }),
      db.channel.count(),
    ]),
    db.costInvoice.aggregate({ _sum: { amountPence: true }, _count: true }),
  ]);
  const [skuCount, bundleCount, channelCount] = counts;

  let stockValue = 0;
  for (const [productId, qty] of stock) {
    const avg = avgCosts.get(productId);
    if (avg != null) stockValue += qty * avg;
  }

  const kpis = [
    {
      label: "Stock value @ landed cost",
      value: formatPence(stockValue),
      icon: Warehouse,
      href: "/stock",
    },
    {
      label: "Open purchase orders",
      value: String(openPos),
      icon: Container,
      href: "/purchase-orders",
    },
    {
      label: "Landed costs allocated",
      value: formatPence(invoiceAgg._sum.amountPence ?? 0),
      sub: `${invoiceAgg._count} invoices`,
      icon: Receipt,
      href: "/cost-invoices",
    },
    {
      label: "Catalogue",
      value: `${skuCount} SKUs`,
      sub: `${bundleCount} bundles · ${channelCount} channels`,
      icon: Package,
      href: "/products",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        hint="Stock value, open purchase orders and channel feeds at a glance."
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
