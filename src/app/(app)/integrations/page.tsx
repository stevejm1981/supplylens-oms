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
import { Card, CardContent } from "@/components/ui/card";
import { TokensCard } from "./tokens-card";

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
  const [channels, tokens] = await Promise.all([
    db.channel.findMany({ select: { code: true, name: true } }),
    db.apiToken.findMany({ orderBy: { createdAt: "desc" } }),
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
