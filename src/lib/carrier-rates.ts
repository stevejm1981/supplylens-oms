// DB-bound side of carrier rate cards: load active cards in the pure
// engine's shape, and match a card to a shipment's service string
// ("Palletways Economy" matches a card whose carrier is "Palletways").

import { db } from "@/lib/db";
import type { RateCard } from "@/lib/engine/carrier-rates";

export async function getActiveRateCards(): Promise<RateCard[]> {
  const cards = await db.carrierRateCard.findMany({
    where: { active: true },
    orderBy: [{ carrier: "asc" }, { name: "asc" }],
    include: { zones: { include: { breaks: { orderBy: { upTo: "asc" } } } } },
  });
  return cards.map((c) => ({
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
}
