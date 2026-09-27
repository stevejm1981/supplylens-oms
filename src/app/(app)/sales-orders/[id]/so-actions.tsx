"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteSalesOrder, invoiceSalesOrder } from "../actions";

export function SoActions({
  id,
  status,
  fullyDespatched,
  anythingDespatched,
  shortLines,
}: {
  id: string;
  status: string;
  fullyDespatched: boolean;
  /** True once any quantity has despatched (enables invoicing at all). */
  anythingDespatched: boolean;
  /** The short lines a partial invoice would short-close, for the confirm. */
  shortLines: { sku: string; ordered: number; despatched: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [shortOpen, setShortOpen] = useState(false);
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
      {status === "OPEN" && !fullyDespatched && anythingDespatched ? (
        <Dialog open={shortOpen} onOpenChange={setShortOpen}>
          <DialogTrigger asChild>
            <Button disabled={pending}>
              <FileText /> Invoice despatched
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invoice what despatched, short-close the rest</DialogTitle>
              <DialogDescription>
                The invoice bills exactly what shipped. Each short line&apos;s
                confirmed quantity is amended down to its despatched quantity
                (audited, the customer&apos;s original numbers are kept), and
                the undespatched balance stops queueing. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <ul className="grid gap-1 text-sm">
              {shortLines.map((l) => (
                <li key={l.sku} className="flex items-center gap-2">
                  <span className="font-mono text-xs font-medium">{l.sku}</span>
                  <span className="text-muted-foreground">
                    {l.despatched} of {l.ordered} despatched, short-closes {l.ordered - l.despatched}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => invoiceSalesOrder(id, { shortClose: true }),
                    "Invoiced despatched quantities, balance short-closed",
                  )
                }
              >
                {pending ? "Invoicing…" : "Invoice despatched quantities"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
