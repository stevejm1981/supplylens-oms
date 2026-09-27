"use client";

// Move the order's fulfilment warehouse. Only offered while nothing has
// shipped (no despatch documents), the action enforces the same rule.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Warehouse } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeOrderWarehouse } from "../actions";

export function ChangeWarehouseDialog({
  orderId,
  currentWarehouseId,
  warehouses,
}: {
  orderId: string;
  currentWarehouseId: string;
  warehouses: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(currentWarehouseId);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Warehouse /> Change warehouse
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change fulfilment warehouse</DialogTitle>
          <DialogDescription>
            Availability, the packing queue, and pick lists all follow the new
            site immediately, and any stock held for this order moves its claim
            with it. Once a despatch exists the warehouse is fixed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Warehouse</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose warehouse" />
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
        <DialogFooter>
          <Button
            disabled={pending || warehouseId === currentWarehouseId}
            onClick={() =>
              startTransition(async () => {
                const result = await changeOrderWarehouse(orderId, warehouseId);
                if (result.ok) {
                  toast.success("Order moved to the new warehouse");
                  setOpen(false);
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              })
            }
          >
            {pending ? "Moving…" : "Move order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
