"use client";

// Status chips. Colours key off the CANONICAL status codes (the machine's
// fixed path); the text comes from Settings via StatusLabelProvider, falling
// back to sensible defaults, so a customer can rename "Draft" to "Held"
// without any logic or integration noticing.

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useStatusLabels } from "@/components/status-label-provider";

const styles: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground border-transparent",
  PLACED: "bg-amber-100 text-amber-800 border-transparent",
  RECEIVED: "bg-emerald-100 text-emerald-800 border-transparent",
  OPEN: "bg-cyan-100 text-cyan-800 border-transparent",
  DISPATCHED: "bg-cyan-100 text-cyan-800 border-transparent",
  INVOICED: "bg-emerald-100 text-emerald-800 border-transparent",
  PICKING: "bg-amber-100 text-amber-800 border-transparent",
  AWAITING: "bg-amber-100 text-amber-800 border-transparent",
  PICKED: "bg-cyan-100 text-cyan-800 border-transparent",
  DESPATCHED: "bg-emerald-100 text-emerald-800 border-transparent",
  UNFULFILLED: "bg-muted text-muted-foreground border-transparent",
  PARTIAL: "bg-amber-100 text-amber-800 border-transparent",
  FULFILLED: "bg-emerald-100 text-emerald-800 border-transparent",
  IN_PROGRESS: "bg-amber-100 text-amber-800 border-transparent",
  COMPLETED: "bg-emerald-100 text-emerald-800 border-transparent",
  UNPAID: "bg-muted text-muted-foreground border-transparent",
  OVERDUE: "bg-rose-100 text-rose-800 border-transparent",
  PAID: "bg-emerald-100 text-emerald-800 border-transparent",
  IS: "bg-emerald-100 text-emerald-800 border-transparent",
  OOS: "bg-rose-100 text-rose-800 border-transparent",
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
  FULFILLED: "Fulfilled",
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
  return (
    <Badge className={cn("font-medium", styles[status] ?? "")} variant="outline">
      {custom[status] ?? fallbackLabels[status] ?? status}
    </Badge>
  );
}
