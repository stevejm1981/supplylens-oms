// Account home: terms, balances, recent orders. The buyer's landing page.

import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getCurrentBuyer } from "@/lib/portal-auth";
import { formatPence } from "@/lib/money";
import { orderNetPence } from "@/lib/sales";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function PortalHome() {
  const buyer = await getCurrentBuyer();
  if (!buyer) redirect("/portal/sign-in");

  const [orders, invoices] = await Promise.all([
    db.salesOrder.findMany({
      where: { customerId: buyer.customerId },
      orderBy: { orderDate: "desc" },
      take: 5,
      include: { lines: true },
    }),
    db.invoice.findMany({
      where: { salesOrder: { customerId: buyer.customerId } },
    }),
  ]);
  const unpaid = invoices.filter((i) => !i.paidAt);
  const outstanding = unpaid.reduce((s, i) => s + i.grossPence, 0);
  const overdue = unpaid
    .filter((i) => i.dueDate && i.dueDate.getTime() < Date.now())
    .reduce((s, i) => s + i.grossPence, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Hello {buyer.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">{buyer.customerName}</p>
        </div>
        <Button asChild>
          <Link href="/portal/catalogue">Browse the catalogue</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Your payment terms</p>
            <p className="text-xl font-semibold">
              {buyer.paymentTermsDays > 0 ? `${buyer.paymentTermsDays} days` : "Payment on order"}
            </p>
            {buyer.paymentTermsDays === 0 ? (
              <p className="mt-1 text-xs text-amber-700">
                Orders are held until payment is arranged.
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-xl font-semibold tabular-nums">{formatPence(outstanding)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{unpaid.length} unpaid invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={`text-xl font-semibold tabular-nums ${overdue > 0 ? "text-rose-600" : ""}`}>
              {formatPence(overdue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent orders</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing yet, your first order is a catalogue away.
            </p>
          ) : (
            orders.map((o) => (
              <Link
                key={o.id}
                href={`/portal/orders/${o.id}`}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
              >
                <span className="font-mono text-xs font-semibold">{o.reference}</span>
                <span className="text-muted-foreground">{dateFmt.format(o.orderDate)}</span>
                <span className="flex-1" />
                <span className="tabular-nums">
                  {formatPence(orderNetPence(o.lines, o.shippingPence, o.taxTreatment))}
                </span>
                <StatusBadge status={o.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
