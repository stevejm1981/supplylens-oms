"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { coverShortfall } from "../actions";

export function CoverShortfallButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function run() {
    startTransition(async () => {
      const result = await coverShortfall(orderId);
      if (result.ok) {
        toast.success(
          `Draft ${result.poReferences.join(" + ")} raised and linked, the stock is spoken for the moment it lands`,
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }
  return (
    <Button size="sm" onClick={run} disabled={pending}>
      <PackagePlus className="size-3.5" />
      {pending ? "Raising…" : "Cover shortfall, raise PO"}
    </Button>
  );
}
