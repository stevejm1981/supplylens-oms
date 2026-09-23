import { AlertTriangle, PackagePlus, TrendingUp } from "lucide-react";

import { getReplenishmentRows } from "@/lib/replenishment";
import {
  ORDER_CYCLE_DAYS,
  SAFETY_STOCK_DAYS,
  VELOCITY_WINDOW_DAYS,
  replenishmentStatusLabels,
} from "@/lib/engine/replenishment";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RaisePoButton } from "./raise-po-button";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

const statusStyles: Record<string, string> = {
  OUT: "border-transparent bg-rose-100 text-rose-800",
  REORDER: "border-transparent bg-amber-100 text-amber-800",
  WATCH: "border-transparent bg-sky-100 text-sky-800",
  OK: "border-transparent bg-emerald-100 text-emerald-800",
  NO_SALES: "border-transparent bg-slate-100 text-slate-600",
};

export default async function ReplenishmentPage() {
  const rows = await getReplenishmentRows();
  const actionable = rows.filter((r) => r.suggestedOrderQty > 0);
  const suggestedUnits = actionable.reduce((s, r) => s + r.suggestedOrderQty, 0);
  const suggestedValue = actionable.reduce(
    (s, r) => s + r.suggestedOrderQty * r.unitCostPence,
    0,
  );

  // One draft PO per supplier covering all its actionable SKUs.
  const bySupplier = new Map<
    string,
    { supplierName: string; lines: { productId: string; quantity: number; unitCostPence: number }[] }
  >();
  for (const r of actionable) {
    if (!r.supplierId) continue;
    const entry = bySupplier.get(r.supplierId) ?? { supplierName: r.supplierName!, lines: [] };
    entry.lines.push({
      productId: r.productId,
      quantity: r.suggestedOrderQty,
      unitCostPence: Math.round(r.unitCostPence),
    });
    bySupplier.set(r.supplierId, entry);
  }

  const kpis = [
    {
      label: "Needs ordering now",
      value: String(rows.filter((r) => r.status === "OUT" || r.status === "REORDER").length),
      sub: `${rows.filter((r) => r.status === "WATCH").length} more to watch`,
      icon: AlertTriangle,
    },
    {
      label: "Suggested order quantity",
      value: `${suggestedUnits} units`,
      sub: `across ${actionable.length} SKUs`,
      icon: PackagePlus,
    },
    {
      label: "Suggested spend @ landed cost",
      value: formatPence(suggestedValue),
      icon: TrendingUp,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Replenishment"
        hint={`Forecasting on what physically shipped: sales velocity over the last ${VELOCITY_WINDOW_DAYS} days (from the despatch ledger, bundle-exploded, pack-converted), days of cover on Available, and a reorder point of velocity × (supplier lead time + ${SAFETY_STOCK_DAYS} safety days). Suggestions top up to velocity × (lead + safety + ${ORDER_CYCLE_DAYS}) and already count inbound POs, so stock on the water is never re-ordered.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <kpi.icon className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-xl font-semibold tabular-nums">{kpi.value}</p>
                {kpi.sub ? <p className="text-xs text-muted-foreground">{kpi.sub}</p> : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {bySupplier.size > 0 ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Raise the buys
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                one draft PO per supplier, pre-filled with every suggested line, review, adjust, place
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            {[...bySupplier.entries()].map(([supplierId, s]) => (
              <div key={supplierId} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <span className="text-sm font-medium">{s.supplierName}</span>
                <RaisePoButton
                  supplierId={supplierId}
                  supplierName={s.supplierName}
                  lines={s.lines}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">SKU</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Sold / {VELOCITY_WINDOW_DAYS}d</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Inbound</TableHead>
                <TableHead className="text-right">Days of cover</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Reorder point</TableHead>
                <TableHead className="pr-6 text-right">Suggested order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.productId}>
                  <TableCell className="pl-6">
                    <span className="font-mono text-xs font-medium">{r.sku}</span>
                    <span className="block text-xs text-muted-foreground">{r.name}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.supplierName ?? ", "}
                    {r.supplierName ? (
                      <span className="block text-xs">{r.leadTimeDays}d lead</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.despatchedInWindow}
                    {r.velocityPerDay > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        {(r.velocityPerDay * 7).toFixed(1)}/wk
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${r.available <= 0 ? "font-semibold text-rose-600" : ""}`}
                  >
                    {r.available}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.onOrder > 0 ? (
                      <>
                        {r.onOrder}
                        <span className="block text-xs text-muted-foreground">
                          {r.nextInboundRef}
                          {r.nextInboundDate ? ` · ${dateFmt.format(r.nextInboundDate)}` : ""}
                        </span>
                      </>
                    ) : (
                      ", "
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.daysOfCover != null ? (
                      <>
                        {Math.floor(r.daysOfCover)}d
                        {r.onOrder > 0 && r.daysOfCoverInbound != null ? (
                          <span className="block text-xs text-muted-foreground">
                            {Math.floor(r.daysOfCoverInbound)}d incl. inbound
                          </span>
                        ) : null}
                      </>
                    ) : (
                      ", "
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusStyles[r.status]}>
                      {replenishmentStatusLabels[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.velocityPerDay > 0 ? r.reorderPointUnits : ", "}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    {r.suggestedOrderQty > 0 ? (
                      <>
                        <span className="font-semibold">{r.suggestedOrderQty}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatPence(r.suggestedOrderQty * r.unitCostPence)}
                        </span>
                      </>
                    ) : (
                      ", "
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
