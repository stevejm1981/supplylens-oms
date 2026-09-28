"use client";

// Per-delivery billed state for the three-way match: a chip plus the
// manual toggle (for suppliers outside the ledger sync). The ledger
// integration flips the same state through the API ack.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { markReceiptBilled } from "../actions";

export function BilledToggle({
  receiptId,
  billedLabel, // server-formatted "Billed 28 Sep 2026", null when unbilled
  externalRef,
}: {
  receiptId: string;
  billedLabel: string | null;
  externalRef: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const billed = billedLabel !== null;

  function toggle() {
    startTransition(async () => {
      const result = await markReceiptBilled(receiptId, !billed);
      if (result.ok) {
        toast.success(billed ? "Delivery set back to awaiting invoice" : "Delivery marked billed");
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {billed ? (
        <Badge className="border-transparent bg-emerald-100 text-emerald-800">
          {billedLabel}
          {externalRef ? ` · ${externalRef}` : ""}
        </Badge>
      ) : (
        <Badge className="border-transparent bg-amber-100 text-amber-800">
          Awaiting supplier invoice
        </Badge>
      )}
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" disabled={pending} onClick={toggle}>
        {billed ? "Unmark" : "Mark billed"}
      </Button>
    </span>
  );
}
