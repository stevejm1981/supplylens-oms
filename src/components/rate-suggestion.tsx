"use client";

// Rate-card suggestion for the expected-carriage field: type the
// consignment size, see what each matching card would charge to the
// delivery postcode, click to use it. A suggestion, never silent.

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPence } from "@/lib/money";
import { rateFor, type RateCard } from "@/lib/engine/carrier-rates";

const UNIT_LABEL: Record<string, string> = {
  PALLET: "pallets",
  CARTON: "cartons",
  WEIGHT: "kg",
};

export function RateSuggestion({
  cards,
  postcode,
  onUse,
}: {
  cards: RateCard[];
  postcode: string | null;
  onUse: (pence: number) => void;
}) {
  const [units, setUnits] = useState("1");
  if (cards.length === 0 || !postcode) return null;

  const n = Number(units) || 0;
  const rated = cards
    .map((card) => ({ card, rate: rateFor(card, postcode, n) }))
    .filter((r) => r.rate);

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Rate card:</span>
      <Input
        className="h-7 w-16 text-right text-xs"
        inputMode="numeric"
        value={units}
        onChange={(e) => setUnits(e.target.value)}
        aria-label="Consignment size"
      />
      <span className="text-muted-foreground">{UNIT_LABEL[cards[0].basis] ?? "units"} to {postcode}</span>
      {rated.length === 0 ? (
        <span className="text-muted-foreground">no card rates this consignment</span>
      ) : (
        rated.map(({ card, rate }) => (
          <Button
            key={card.name}
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onUse(rate!.pricePence)}
          >
            {card.carrier} {formatPence(rate!.pricePence)}
          </Button>
        ))
      )}
    </div>
  );
}
