// Carrier rate cards, priced the way UK carriers price: zone (delivery
// postcode area) x consignment size band. Pure derivation, no DB: the
// matched rate is only ever a SUGGESTION for expected carriage; the
// accrual journal that follows is unchanged.

export interface RateBreak {
  upTo: number; // applies to consignments of <= this many units
  pricePence: number;
}

export interface RateZone {
  name: string;
  postcodeAreas: string[]; // outward-code letters: "BS", "CF", "M"
  perExtraUnitPence?: number | null; // beyond the last break; null = no rate
  breaks: RateBreak[];
}

export interface RateCard {
  carrier: string;
  name: string;
  basis: string; // "PALLET" | "CARTON" | "WEIGHT"
  zones: RateZone[];
}

/**
 * The postcode AREA is the leading letters of the outward code:
 * "BS11 8DD" → "BS", "M17 1WA" → "M", "EC1N 2HT" → "EC".
 */
export function postcodeArea(postcode: string | null | undefined): string | null {
  const match = postcode?.trim().toUpperCase().match(/^([A-Z]{1,2})[0-9]/);
  return match ? match[1] : null;
}

export function zoneFor(card: RateCard, postcode: string | null | undefined): RateZone | null {
  const area = postcodeArea(postcode);
  if (!area) return null;
  return card.zones.find((z) => z.postcodeAreas.map((a) => a.toUpperCase()).includes(area)) ?? null;
}

/**
 * Rate for a consignment of `units` (pallets/cartons/kg per the card's
 * basis) to `postcode`. Breaks are cumulative caps ("up to N units costs
 * X"); beyond the last break each extra unit adds perExtraUnitPence, or
 * the consignment is unrateable (null) when no per-extra rate is set.
 */
export function rateFor(
  card: RateCard,
  postcode: string | null | undefined,
  units: number,
): { zone: string; pricePence: number } | null {
  if (!Number.isFinite(units) || units <= 0) return null;
  const zone = zoneFor(card, postcode);
  if (!zone || zone.breaks.length === 0) return null;
  const breaks = [...zone.breaks].sort((a, b) => a.upTo - b.upTo);
  const match = breaks.find((b) => units <= b.upTo);
  if (match) return { zone: zone.name, pricePence: match.pricePence };
  const last = breaks[breaks.length - 1];
  if (zone.perExtraUnitPence == null) return null;
  const extra = Math.ceil(units - last.upTo);
  return { zone: zone.name, pricePence: last.pricePence + extra * zone.perExtraUnitPence };
}

/**
 * Cards whose carrier name appears in the shipment's service string
 * ("Palletways Economy" matches carrier "Palletways"); all cards when the
 * service is blank or nothing matches.
 */
export function cardsForService(cards: RateCard[], service: string | null | undefined): RateCard[] {
  if (!service?.trim()) return cards;
  const s = service.toLowerCase();
  const matched = cards.filter((c) => s.includes(c.carrier.toLowerCase()));
  return matched.length > 0 ? matched : cards;
}
