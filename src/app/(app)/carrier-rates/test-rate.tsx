"use client";

// The "test a postcode" mini-calculator: proves a card prices the way the
// carrier's paper rate card says it should, before it ever suggests a rate.

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatPence } from "@/lib/money";
import { rateFor, type RateCard } from "@/lib/engine/carrier-rates";

export function TestRate({ cards }: { cards: RateCard[] }) {
  const [postcode, setPostcode] = useState("");
  const [units, setUnits] = useState("1");

  const n = Number(units) || 0;
  const results = cards
    .map((card) => ({ card, rate: rateFor(card, postcode, n) }))
    .filter((r) => r.rate);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Input
        className="w-36"
        placeholder="Postcode"
        value={postcode}
        onChange={(e) => setPostcode(e.target.value)}
      />
      <Input
        className="w-20 text-right"
        inputMode="numeric"
        value={units}
        onChange={(e) => setUnits(e.target.value)}
      />
      <span className="text-xs text-muted-foreground">units</span>
      {postcode.trim() === "" ? null : results.length === 0 ? (
        <span className="text-xs text-muted-foreground">No active card rates this consignment</span>
      ) : (
        results.map(({ card, rate }) => (
          <span key={card.name} className="rounded bg-secondary px-2 py-1 text-xs">
            {card.carrier} · {card.name}: <b>{formatPence(rate!.pricePence)}</b> ({rate!.zone})
          </span>
        ))
      )}
    </div>
  );
}
