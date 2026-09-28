// Carrier rate cards: the fallback expected-carriage source when a 3PL
// cannot supply the rate per shipment. Zone x size-band pricing; matched
// rates SUGGEST expected carriage at despatch, never apply silently in
// the UI, and drive the accrual only when the API confirmation asks.

import { Milestone } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { deleteRateCard } from "./actions";
import { RateCardDialog, type CardView } from "./rate-card-dialog";
import { TestRate } from "./test-rate";

const BASIS_LABEL: Record<string, string> = {
  PALLET: "per pallet",
  CARTON: "per carton",
  WEIGHT: "per kg",
};

export default async function CarrierRatesPage() {
  const cards = await db.carrierRateCard.findMany({
    orderBy: [{ carrier: "asc" }, { name: "asc" }],
    include: { zones: { include: { breaks: { orderBy: { upTo: "asc" } } } } },
  });

  const toView = (card: (typeof cards)[number]): CardView => ({
    id: card.id,
    carrier: card.carrier,
    name: card.name,
    basis: card.basis,
    active: card.active,
    notes: card.notes,
    zones: card.zones.map((z) => ({
      name: z.name,
      areas: z.postcodeAreas.join(", "),
      breaks: z.breaks.map((b) => `${b.upTo}:${(b.pricePence / 100).toFixed(2)}`).join(", "),
      perExtra: z.perExtraUnitPence != null ? (z.perExtraUnitPence / 100).toFixed(2) : "",
    })),
  });

  const engineCards = cards
    .filter((c) => c.active)
    .map((c) => ({
      carrier: c.carrier,
      name: c.name,
      basis: c.basis,
      zones: c.zones.map((z) => ({
        name: z.name,
        postcodeAreas: z.postcodeAreas,
        perExtraUnitPence: z.perExtraUnitPence,
        breaks: z.breaks.map((b) => ({ upTo: b.upTo, pricePence: b.pricePence })),
      })),
    }));

  return (
    <div>
      <PageHeader
        title="Carrier Rates"
        hint="Rate cards price a consignment the way carriers do: delivery postcode area picks the zone, consignment size picks the break. The matched rate pre-fills expected carriage at despatch (editable), and API despatch confirmations without a cost can apply it automatically. When the 3PL supplies the actual rate per shipment, that always wins."
      >
        <RateCardDialog />
      </PageHeader>

      {cards.length === 0 ? (
        <EmptyState
          icon={Milestone}
          title="No rate cards yet"
          description="Key a carrier's rate card once, and expected carriage suggests itself on every despatch the 3PL cannot price."
        >
          <RateCardDialog />
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Test a postcode
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  check the cards against the carrier&apos;s own paper before trusting them
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TestRate cards={engineCards} />
            </CardContent>
          </Card>

          {cards.map((card) => (
            <Card key={card.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">
                  {card.carrier}
                  <span className="ml-2 font-normal text-muted-foreground">{card.name}</span>
                  <Badge variant="outline" className="ml-2 font-normal">
                    {BASIS_LABEL[card.basis] ?? card.basis}
                  </Badge>
                  {!card.active ? (
                    <Badge className="ml-2 border-transparent bg-amber-100 text-amber-800">
                      Inactive
                    </Badge>
                  ) : null}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <RateCardDialog card={toView(card)} />
                  <ConfirmDelete id={card.id} label="rate card" action={deleteRateCard} />
                </div>
              </CardHeader>
              <CardContent className="grid gap-2">
                {card.zones.map((zone) => (
                  <div key={zone.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-28 font-medium">{zone.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {zone.postcodeAreas.join(" ")}
                    </span>
                    {zone.breaks.map((b) => (
                      <span key={b.id} className="rounded bg-secondary px-1.5 py-0.5 text-xs tabular-nums">
                        ≤{b.upTo}: {formatPence(b.pricePence)}
                      </span>
                    ))}
                    {zone.perExtraUnitPence != null ? (
                      <span className="text-xs text-muted-foreground">
                        then {formatPence(zone.perExtraUnitPence)}/unit
                      </span>
                    ) : null}
                  </div>
                ))}
                {card.notes ? (
                  <p className="text-xs text-muted-foreground">{card.notes}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
