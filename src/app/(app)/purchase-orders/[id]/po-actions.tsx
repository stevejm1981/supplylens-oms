"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, PackageCheck, Trash2 } from "lucide-react";

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
import {
  deletePurchaseOrder,
  placePurchaseOrder,
  receivePurchaseOrder,
} from "../actions";

export interface WarehouseOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export function PoActions({
  id,
  status,
  warehouses,
}: {
  id: string;
  status: string;
  warehouses: WarehouseOption[];
}) {
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean } & { error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        setReceiveOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {status === "DRAFT" ? (
        <>
          <Button
            disabled={pending}
            onClick={() => run(() => placePurchaseOrder(id), "Purchase order placed")}
          >
            <CheckCircle2 /> Place order
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const r = await deletePurchaseOrder(id);
                if (r.ok) router.push("/purchase-orders");
                return r;
              }, "Purchase order deleted")
            }
          >
            <Trash2 /> Delete
          </Button>
        </>
      ) : null}
      {status === "PLACED" ? (
        <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
          <DialogTrigger asChild>
            <Button>
              <PackageCheck /> Receive
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Receive purchase order</DialogTitle>
              <DialogDescription>
                Stock will be added to this location and the order locked.
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
                      {w.isDefault ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                disabled={pending || !warehouseId}
                onClick={() =>
                  run(() => receivePurchaseOrder(id, warehouseId), "Stock received")
                }
              >
                {pending ? "Receiving…" : "Receive into stock"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
