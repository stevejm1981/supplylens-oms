import {
  Banknote,
  Cable,
  FileCode2,
  Globe,
  ShoppingBag,
  Store,
  Truck,
  Warehouse,
} from "lucide-react";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TokensCard } from "./tokens-card";

const timeFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

// The catalogue: what the platform connects to. Status is derived,
// "Connected" when a channel with a matching sync key exists, "Ready" when
// the OMS-side endpoints are live and waiting for a flow.
interface IntegrationDef {
  name: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
  channelMatch?: string; // substring of a channel code → Connected
  ready?: string; // endpoint(s) that make it "Ready"
}

const CATALOGUE: IntegrationDef[] = [
  {
    name: "Mirakl marketplaces",
    category: "Marketplace",
    icon: Store,
    blurb: "Tesco, B&Q and other Mirakl-powered marketplaces, orders in, stock feeds out.",
    channelMatch: "mirakl",
  },
  {
    name: "The Very Group",
    category: "Marketplace",
    icon: Store,
    blurb: "Orders and buffered stock feeds with the ≤5 → out-of-stock rule.",
    channelMatch: "very",
  },
  {
    name: "Frasers Group",
    category: "Marketplace",
    icon: Store,
    blurb: "Orders and stock feeds with the −20 safety buffer.",
    channelMatch: "frasers",
  },
  {
    name: "Shopify",
    category: "E-commerce",
    icon: ShoppingBag,
    blurb: "DTC storefront orders, fulfilment and tracking updates.",
    channelMatch: "shopify",
  },
  {
    name: "Amazon Seller Central",
    category: "Marketplace",
    icon: Globe,
    blurb: "MFN orders in, despatch confirmations and stock feeds back.",
    channelMatch: "amazon",
  },
  {
    name: "EDI (ORDERS / 850)",
    category: "EDI",
    icon: FileCode2,
    blurb: "Retailer EDI: idempotent order intake, ORDRSP/DESADV from order readback.",
    ready: "POST /sales-orders · GET /sales-orders/{ref}",
  },
  {
    name: "3PL / WMS",
    category: "Fulfilment",
    icon: Warehouse,
    blurb: "Orders out to the warehouse; despatch confirmations and goods-in back.",
    ready: "POST …/despatches · POST …/receipts",
  },
  {
    name: "Xero",
    category: "Accounting",
    icon: Banknote,
    blurb: "Stock journals at landed cost, invoices and credits out; paid confirmations back.",
    ready: "GET /stock-journals · POST /invoices/{n}/paid",
  },
  {
    name: "QuickBooks",
    category: "Accounting",
    icon: Banknote,
    blurb: "Same accounting outbox, QuickBooks-shaped mapping.",
    ready: "GET /stock-journals",
  },
  {
    name: "DPD",
    category: "Carrier",
    icon: Truck,
    blurb: "Shipping labels on your own business account from the Despatch Station.",
  },
  {
    name: "Royal Mail",
    category: "Carrier",
    icon: Truck,
    blurb: "Click & Drop shipping and tracking.",
  },
];

const statusStyles: Record<string, string> = {
  Connected: "border-transparent bg-emerald-100 text-emerald-800",
  Ready: "border-transparent bg-cyan-100 text-cyan-800",
  Available: "border-transparent bg-muted text-muted-foreground",
};

export default async function IntegrationsPage() {
  const user = (await getCurrentUser())!;
  const dayStart = new Date(new Date().setHours(0, 0, 0, 0));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [channels, tokens, callsToday, callsMonth, recentCalls, byToken] = await Promise.all([
    db.channel.findMany({ select: { code: true, name: true } }),
    db.apiToken.findMany({ orderBy: { createdAt: "desc" } }),
    db.apiRequestLog.count({ where: { createdAt: { gte: dayStart } } }),
    db.apiRequestLog.count({ where: { createdAt: { gte: monthStart } } }),
    db.apiRequestLog.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
    db.apiRequestLog.groupBy({
      by: ["tokenName"],
      where: { createdAt: { gte: monthStart } },
      _count: true,
      orderBy: { _count: { tokenName: "desc" } },
    }),
  ]);

  const cards = CATALOGUE.map((def) => {
    const channel = def.channelMatch
      ? channels.find((c) => c.code.toLowerCase().includes(def.channelMatch!))
      : undefined;
    const status = channel ? "Connected" : def.ready ? "Ready" : "Available";
    return { ...def, status, channelCode: channel?.code ?? null };
  });

  return (
    <div>
      <PageHeader
        title="Integrations"
        hint="What the platform connects to, and the credentials it connects with. Connected = a channel in this OMS carries the integration's sync key today. Ready = the OMS-side endpoints are live, waiting for a flow to be switched on. Available = connected through the SupplyLens platform on request. Generate one API token per integration so each can be revoked independently."
      />

      <div className="mb-6">
        <TokensCard
          canManage={user.role === "OWNER" || user.role === "ADMIN"}
          tokens={tokens.map((t) => ({
            id: t.id,
            name: t.name,
            prefix: t.prefix,
            created: dateFmt.format(t.createdAt),
            lastUsed: t.lastUsedAt ? dateFmt.format(t.lastUsedAt) : null,
            revoked: Boolean(t.revokedAt),
          }))}
        />
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              API activity
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                every authenticated call, per integration; monitored for support and fair use, never billed
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <div className="grid content-start gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Today</p>
                <p className="text-2xl font-semibold tabular-nums">{callsToday.toLocaleString("en-GB")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This month</p>
                <p className="text-2xl font-semibold tabular-nums">{callsMonth.toLocaleString("en-GB")}</p>
              </div>
              <div className="grid gap-1 text-xs text-muted-foreground">
                {byToken.map((t) => (
                  <span key={t.tokenName ?? "env"}>
                    {t.tokenName ?? "environment key"} · {t._count.toLocaleString("en-GB")}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              {recentCalls.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No calls logged yet. Every authenticated API request appears here from now on.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-4">When</th>
                      <th className="py-1.5 pr-4">Method</th>
                      <th className="py-1.5 pr-4">Path</th>
                      <th className="py-1.5">Token</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalls.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-4 tabular-nums text-muted-foreground">
                          {timeFmt.format(c.createdAt)}
                        </td>
                        <td className="py-1.5 pr-4 font-mono text-xs font-semibold">{c.method}</td>
                        <td className="py-1.5 pr-4 font-mono text-xs">{c.path}</td>
                        <td className="py-1.5 text-xs text-muted-foreground">
                          {c.tokenName ?? "environment key"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.name}>
            <CardContent className="flex h-full flex-col gap-3 pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <card.icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{card.name}</p>
                  <p className="text-xs text-muted-foreground">{card.category}</p>
                </div>
                <Badge className={statusStyles[card.status]}>{card.status}</Badge>
              </div>
              <p className="flex-1 text-sm text-muted-foreground">{card.blurb}</p>
              {card.channelCode ? (
                <p className="text-xs text-muted-foreground">
                  sync key <code className="font-mono">{card.channelCode}</code>
                </p>
              ) : card.ready ? (
                <p className="truncate text-xs text-muted-foreground">
                  <code className="font-mono text-[11px]">{card.ready}</code>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">via the SupplyLens platform</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t see what you&apos;re looking for? That&apos;s where <b>how we connect</b> becomes
        the icing on the cake, anything with an API, a file drop or an EDI mailbox
        can be wired through the platform.
      </p>
    </div>
  );
}
