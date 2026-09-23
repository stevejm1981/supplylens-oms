"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockKeyhole, Unlock } from "lucide-react";

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
import { ProductCombobox } from "@/components/product-combobox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createReservation, releaseReservation } from "./actions";

export interface OpenPoOption {
  id: string;
  reference: string;
  supplierName: string;
}

export function NewReservationDialog({
  products,
  warehouses,
  customers,
  openPos,
}: {
  products: { id: string; sku: string; name: string }[];
  warehouses: { id: string; name: string; isDefault: boolean }[];
  customers: { id: string; name: string }[];
  openPos: OpenPoOption[];
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [awaitingPoId, setAwaitingPoId] = useState("none");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await createReservation({
        productId,
        warehouseId,
        quantity: Number(quantity) || 0,
        customerId: customerId === "none" ? null : customerId,
        awaitingPoId: awaitingPoId === "none" ? null : awaitingPoId,
        reason: reason || null,
        expiresAt: expiresAt || null,
      });
      if (result.ok) {
        toast.success("Stock reserved");
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
        <Button>
          <LockKeyhole /> Reserve stock
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve stock</DialogTitle>
          <DialogDescription>
            Ring-fence quantity so nothing else can sell it, it drops out of
            Available and channel feeds immediately. Hold it for a customer and
            their despatches consume it automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="grid gap-1.5">
              <Label>Product</Label>
              <ProductCombobox products={products} value={productId} onChange={setProductId} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rsv-qty">Quantity</Label>
              <Input
                id="rsv-qty"
                inputMode="numeric"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Warehouse</Label>
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
            <div className="grid gap-1.5">
              <Label>Held for customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nobody, general hold</SelectItem>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Awaiting inbound PO (optional)</Label>
            <Select value={awaitingPoId} onValueChange={setAwaitingPoId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No, reserve from current stock</SelectItem>
                {openPos.map((po) => (
                  <SelectItem key={po.id} value={po.id}>
                    <span className="font-mono text-xs">{po.reference}</span>, {po.supplierName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Shipment on the water? Link its PO, the hold sits pending and snaps on
              the instant the goods are received, before any channel can see them.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rsv-reason">Reason</Label>
              <Input
                id="rsv-reason"
                placeholder="Autumn pre-order launch"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rsv-expiry">Expires</Label>
              <Input
                id="rsv-expiry"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Reserving…" : "Reserve stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReleaseButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await releaseReservation(id);
          if (result.ok) {
            toast.success("Reservation released, stock available again");
            router.refresh();
          } else {
            toast.error(result.error ?? "Release failed");
          }
        })
      }
    >
      <Unlock /> Release
    </Button>
  );
}
