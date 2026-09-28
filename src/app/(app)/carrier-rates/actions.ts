"use server";

// Carrier rate cards: zone (postcode areas) x size-band pricing. Saving
// replaces the card's zones and breaks wholesale (cards are small and
// edited rarely); rates only ever SUGGEST expected carriage, so editing a
// card never touches existing accruals.

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export interface RateCardInput {
  id?: string;
  carrier: string;
  name: string;
  basis: string; // "PALLET" | "CARTON" | "WEIGHT"
  active: boolean;
  notes: string | null;
  zones: {
    name: string;
    postcodeAreas: string[];
    perExtraUnitPence: number | null;
    breaks: { upTo: number; pricePence: number }[];
  }[];
}

const BASES = ["PALLET", "CARTON", "WEIGHT"];

export async function saveRateCard(input: RateCardInput): Promise<ActionResult> {
  const carrier = input.carrier.trim();
  const name = input.name.trim();
  if (!carrier || !name) return { ok: false, error: "Carrier and card name are required" };
  if (!BASES.includes(input.basis)) return { ok: false, error: "Basis must be pallet, carton, or weight" };
  if (input.zones.length === 0) return { ok: false, error: "Add at least one zone" };
  for (const zone of input.zones) {
    if (!zone.name.trim()) return { ok: false, error: "Every zone needs a name" };
    const areas = zone.postcodeAreas.map((a) => a.trim().toUpperCase()).filter(Boolean);
    if (areas.length === 0) {
      return { ok: false, error: `Zone "${zone.name}" needs at least one postcode area` };
    }
    if (areas.some((a) => !/^[A-Z]{1,2}$/.test(a))) {
      return {
        ok: false,
        error: `Zone "${zone.name}": postcode areas are the outward letters only (BS, CF, M)`,
      };
    }
    zone.postcodeAreas = areas;
    if (zone.breaks.length === 0) {
      return { ok: false, error: `Zone "${zone.name}" needs at least one price break` };
    }
    for (const b of zone.breaks) {
      if (!Number.isInteger(b.upTo) || b.upTo <= 0 || !Number.isInteger(b.pricePence) || b.pricePence < 0) {
        return { ok: false, error: `Zone "${zone.name}": breaks need whole units and a price` };
      }
    }
    const upTos = zone.breaks.map((b) => b.upTo);
    if (new Set(upTos).size !== upTos.length) {
      return { ok: false, error: `Zone "${zone.name}" has two breaks for the same unit count` };
    }
  }

  try {
    const id = await db.$transaction(async (tx) => {
      const data = {
        carrier,
        name,
        basis: input.basis,
        active: input.active,
        notes: input.notes?.trim() || null,
      };
      const card = input.id
        ? await tx.carrierRateCard.update({ where: { id: input.id }, data })
        : await tx.carrierRateCard.create({ data });
      if (input.id) await tx.carrierRateZone.deleteMany({ where: { cardId: card.id } });
      for (const zone of input.zones) {
        await tx.carrierRateZone.create({
          data: {
            cardId: card.id,
            name: zone.name.trim(),
            postcodeAreas: zone.postcodeAreas,
            perExtraUnitPence: zone.perExtraUnitPence,
            breaks: { create: zone.breaks.map((b) => ({ upTo: b.upTo, pricePence: b.pricePence })) },
          },
        });
      }
      return card.id;
    });
    revalidatePath("/carrier-rates");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed" };
  }
}

export async function deleteRateCard(id: string): Promise<ActionResult> {
  try {
    await db.carrierRateCard.delete({ where: { id } });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Delete failed" };
  }
  revalidatePath("/carrier-rates");
  return { ok: true };
}
