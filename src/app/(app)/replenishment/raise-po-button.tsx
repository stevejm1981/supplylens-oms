"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createPurchaseOrder } from "../purchase-orders/actions";

export interface SuggestedPoLine {
  productId: string;
  quantity: number;
  unitCostPence: number;
}

export function RaisePoButton({
  supplierId,
  supplierName,
  lines,
}: {
  supplierId: string;
  supplierName: string;
  lines: SuggestedPoLine[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function raise() {
    startTransition(async () => {
      const result = await createPurchaseOrder({
        supplierId,
        containerRef: null,
        expectedDate: null,
        notes: "Raised from replenishment suggestions",
        lines,
      });
      if (result.ok) {
        toast.success(`Draft PO raised on ${supplierName}, review and place it`);
        router.push(result.id ? `/purchase-orders/${result.id}` : "/purchase-orders");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={raise} disabled={pending}>
      <PackagePlus className="size-3.5" />
      {pending ? "Raising…" : `Draft PO, ${lines.length} SKU${lines.length === 1 ? "" : "s"}`}
    </Button>
  );
}
