"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CircleCheck, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markInvoicePaid, markInvoiceUnpaid } from "./actions";

export function PaidButton({ id, paid }: { id: string; paid: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function run() {
    startTransition(async () => {
      const result = paid ? await markInvoiceUnpaid(id) : await markInvoicePaid(id);
      if (result.ok) {
        toast.success(paid ? "Payment unmarked" : "Marked paid");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }
  return (
    <Button size="sm" variant={paid ? "ghost" : "outline"} onClick={run} disabled={pending}>
      {paid ? (
        <>
          <Undo2 className="size-3.5" /> Unmark
        </>
      ) : (
        <>
          <CircleCheck className="size-3.5" /> Mark paid
        </>
      )}
    </Button>
  );
}
