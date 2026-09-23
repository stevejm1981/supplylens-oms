"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteSalesOrder, invoiceSalesOrder } from "../actions";

export function SoActions({
  id,
  status,
  fullyDespatched,
}: {
  id: string;
  status: string;
  fullyDespatched: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean } & { error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" ? (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await deleteSalesOrder(id);
              if (r.ok) router.push("/sales-orders");
              return r;
            }, "Sales order deleted")
          }
        >
          <Trash2 /> Delete
        </Button>
      ) : null}
      {status === "OPEN" && fullyDespatched ? (
        <Button
          disabled={pending}
          onClick={() => run(() => invoiceSalesOrder(id), "Invoice created")}
        >
          <FileText /> Create invoice
        </Button>
      ) : null}
    </div>
  );
}
