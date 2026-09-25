"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

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
import { portalRequestReturn } from "../../actions";

export function RequestReturnDialog({
  orderId,
  lines,
}: {
  orderId: string;
  lines: { orderLineId: string; sku: string; max: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await portalRequestReturn({
        orderId,
        reason,
        lines: lines.map((l) => ({
          orderLineId: l.orderLineId,
          quantity: Number(qty[l.orderLineId]) || 0,
        })),
      });
      if (result.ok) {
        toast.success("Return requested, we will confirm what happens next");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RotateCcw className="size-3.5" /> Request a return
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a return</DialogTitle>
          <DialogDescription>
            Tell us what is coming back and why, we will confirm the next steps.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {lines.map((l) => (
            <div key={l.orderLineId} className="grid grid-cols-[1fr_100px] items-center gap-2">
              <span>
                <span className="font-mono text-xs font-medium">{l.sku}</span>
                <span className="ml-2 text-xs text-muted-foreground">up to {l.max}</span>
              </span>
              <Input
                inputMode="numeric"
                placeholder="0"
                value={qty[l.orderLineId] ?? ""}
                onChange={(e) => setQty((p) => ({ ...p, [l.orderLineId]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="ret-reason">Reason</Label>
            <Input
              id="ret-reason"
              placeholder="Damaged in transit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
