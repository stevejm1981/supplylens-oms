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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCustomerReturn } from "../../returns/actions";

export interface ReturnableLine {
  orderLineId: string;
  sku: string;
  returnable: number; // despatched − already on returns
}

export function BookReturnDialog({
  salesOrderId,
  lines,
  warehouses,
  defaultWarehouseId,
}: {
  salesOrderId: string;
  lines: ReturnableLine[];
  warehouses: { id: string; name: string }[];
  defaultWarehouseId: string;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const returnable = lines.filter((l) => l.returnable > 0);
  if (returnable.length === 0) return null;

  function submit() {
    startTransition(async () => {
      const result = await createCustomerReturn({
        salesOrderId,
        warehouseId,
        reason: reason || null,
        lines: returnable.map((l) => ({
          orderLineId: l.orderLineId,
          quantity: Number(qty[l.orderLineId] ?? 0) || 0,
        })),
      });
      if (result.ok) {
        toast.success("Return booked, receive it from the Returns page");
        setOpen(false);
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
          <RotateCcw /> Book return
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Book customer return</DialogTitle>
          <DialogDescription>
            An RMA for goods on their way back. Triage into restock or write-off
            happens when you receive it, the credit note raises itself then.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {returnable.map((l) => (
            <div key={l.orderLineId} className="flex items-center justify-between gap-3 text-sm">
              <span>
                <span className="font-mono text-xs font-medium">{l.sku}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  up to {l.returnable}
                </span>
              </span>
              <Input
                className="h-8 w-20 text-right"
                inputMode="numeric"
                placeholder="0"
                value={qty[l.orderLineId] ?? ""}
                onChange={(e) => setQty((p) => ({ ...p, [l.orderLineId]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="rma-reason">Reason</Label>
            <Input
              id="rma-reason"
              placeholder="Unwanted / damaged in transit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Return to warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Booking…" : "Book return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
