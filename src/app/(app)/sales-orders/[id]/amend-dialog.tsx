"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilRuler } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { amendOrderQuantities } from "../actions";

export interface AmendableLine {
  orderLineId: string;
  sku: string;
  originalQty: number;
  quantity: number;
}

export function AmendDialog({
  orderId,
  lines,
}: {
  orderId: string;
  lines: AmendableLine[];
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await amendOrderQuantities(
        orderId,
        lines.map((l) => ({
          orderLineId: l.orderLineId,
          quantity: Number(qty[l.orderLineId] ?? l.quantity),
        })),
        reason,
      );
      if (result.ok) {
        toast.success("Quantities amended, original values preserved");
        setOpen(false);
        setQty({});
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PencilRuler /> Amend quantities
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Amend confirmed quantities</DialogTitle>
          <DialogDescription>
            The customer&apos;s original quantities are preserved forever, you are
            setting what will actually be released. 0 short-cancels a line but keeps
            it in fill-rate reporting.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_90px_90px] items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Line</span>
            <span className="text-right">Original</span>
            <span className="text-right">Confirmed</span>
          </div>
          {lines.map((l) => {
            const current = Number(qty[l.orderLineId] ?? l.quantity);
            return (
              <div key={l.orderLineId} className="grid grid-cols-[1fr_90px_90px] items-center gap-2">
                <span className="font-mono text-xs font-medium">{l.sku}</span>
                <span className="text-right tabular-nums text-muted-foreground">
                  {l.originalQty}
                </span>
                <Input
                  className={`h-8 text-right ${current > l.originalQty ? "border-amber-400" : ""}`}
                  inputMode="numeric"
                  value={qty[l.orderLineId] ?? String(l.quantity)}
                  onChange={(e) => setQty((p) => ({ ...p, [l.orderLineId]: e.target.value }))}
                />
              </div>
            );
          })}
          {lines.some((l) => Number(qty[l.orderLineId] ?? l.quantity) > l.originalQty) ? (
            <p className="text-xs text-amber-700">
              A confirmed quantity is above the customer&apos;s original, make sure
              that increase is approved.
            </p>
          ) : null}
          <div className="grid gap-1.5">
            <Label htmlFor="amend-reason">Reason (required)</Label>
            <Input
              id="amend-reason"
              placeholder="Stock shortage, agreed with buyer"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save amendments"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
