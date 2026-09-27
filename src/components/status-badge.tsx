"use client";

// Status chips in the Ordo status language. Colours key off the CANONICAL
// status codes (the machine's fixed path) mapped onto the brand kit's five
// semantic statuses (new, picking, dispatched, hold, exception), each read
// from the st-* theme tokens so every direction and mode recolours them.
// Per the brand book, a status always shows its word AND a glyph, never
// colour alone. Text comes from Settings via StatusLabelProvider, so a
// customer can rename "Draft" to "Held" without any logic noticing.

import { Badge } from "@/components/ui/badge";
import { useStatusLabels } from "@/components/status-label-provider";

type Tone = "new" | "picking" | "dispatched" | "hold" | "exception";

const tones: Record<string, Tone> = {
  // fresh, just arrived
  OPEN: "new",
  PLACED: "new",
  // in motion
  PICKING: "picking",
  PICKED: "picking",
  IN_PROGRESS: "picking",
  PARTIAL: "picking",
  PARTIALLY_RECEIVED: "picking",
  UNPAID: "picking",
  // done
  DESPATCHED: "dispatched",
  DISPATCHED: "dispatched",
  RECEIVED: "dispatched",
  INVOICED: "dispatched",
  FULFILLED: "dispatched",
  COMPLETED: "dispatched",
  PAID: "dispatched",
  SENT: "dispatched",
  ACTIVE: "dispatched",
  IS: "dispatched",
  // paused, waiting on someone
  DRAFT: "hold",
  AWAITING: "hold",
  PENDING: "hold",
  UNFULFILLED: "hold",
  RELEASED: "hold",
  // needs a human now
  OVERDUE: "exception",
  OOS: "exception",
};

// Ring, half disc, filled disc, two bars, diamond: the brand book's glyphs,
// so the two most common states differ in more than hue.
const glyphs: Record<Tone, string> = {
  new: "○",
  picking: "◐",
  dispatched: "●",
  hold: "▮▮",
  exception: "◆",
};

const fallbackLabels: Record<string, string> = {
  DRAFT: "Draft",
  PLACED: "Placed",
  RECEIVED: "Received",
  OPEN: "Open",
  DISPATCHED: "Despatched",
  INVOICED: "Invoiced",
  PICKING: "Picking",
  AWAITING: "Awaiting",
  PICKED: "Picked",
  DESPATCHED: "Despatched",
  UNFULFILLED: "Unfulfilled",
  PARTIAL: "Part fulfilled",
  PARTIALLY_RECEIVED: "Part received",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  UNPAID: "Unpaid",
  OVERDUE: "Overdue",
  PAID: "Paid",
  IS: "In stock",
  OOS: "Out of stock",
};

export function StatusBadge({ status }: { status: string }) {
  const custom = useStatusLabels();
  const tone = tones[status] ?? "hold";
  return (
    <Badge
      className="gap-1 border-transparent font-medium"
      variant="outline"
      style={{ background: `var(--st-${tone}-bg)`, color: `var(--st-${tone}-ink)` }}
    >
      <span aria-hidden className={tone === "hold" ? "text-[7px] tracking-tighter" : "text-[9px]"}>
        {glyphs[tone]}
      </span>
      {custom[status] ?? fallbackLabels[status] ?? status}
    </Badge>
  );
}
