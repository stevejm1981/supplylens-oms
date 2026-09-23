"use client";

// Dialogs for the two stock documents: adjustments (± deltas with a reason)
// and warehouse transfers (from → to). Both show live on-hand so the operator
// sees the resulting balance before committing.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, ClipboardEdit, Plus, Trash2 } from "lucide-react";

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
import { ProductCombobox } from "@/components/product-combobox";
import { createAdjustment, createTransfer } from "./actions";

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
}
export interface WarehouseOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

interface DocLine {
  key: number;
  productId: string;
  quantity: string;
}

/** on-hand lookup keyed `${productId}|${warehouseId}` */
export type LevelMap = Record<string, number>;

function useDocLines() {
  const [lines, setLines] = useState<DocLine[]>([{ key: 1, productId: "", quantity: "" }]);
  const update = (key: number, patch: Partial<DocLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const add = () =>
    setLines((prev) => [
      ...prev,
      { key: Math.max(...prev.map((l) => l.key), 0) + 1, productId: "", quantity: "" },
    ]);
  const remove = (key: number) => setLines((prev) => prev.filter((l) => l.key !== key));
  const reset = () => setLines([{ key: 1, productId: "", quantity: "" }]);
  return { lines, update, add, remove, reset };
}

function ProductSelect({
  value,
  onChange,
  products,
}: {
  value: string;
  onChange: (v: string) => void;
  products: ProductOption[];
}) {
  return <ProductCombobox products={products} value={value} onChange={onChange} />;
}

export function NewAdjustmentDialog({
  products,
  warehouses,
  levels,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  levels: LevelMap;
}) {
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const { lines, update, add, remove, reset } = useDocLines();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await createAdjustment({
        warehouseId,
        reason,
        notes: notes || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantityDelta: Number(l.quantity) || 0,
        })),
      });
      if (result.ok) {
        toast.success("Adjustment applied, stock and ledger updated");
        setOpen(false);
        reset();
        setReason("");
        setNotes("");
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
          <ClipboardEdit /> New adjustment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New stock adjustment</DialogTitle>
          <DialogDescription>
            Applies immediately: quantities move and the ledger records each
            line. Corrections are made with a counter-adjustment, the document
            trail is permanent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="grid gap-1.5">
              <Label htmlFor="adj-reason">Reason</Label>
              <Input
                id="adj-reason"
                placeholder="Stocktake variance"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            {lines.map((line) => {
              const have = levels[`${line.productId}|${warehouseId}`] ?? 0;
              const delta = Number(line.quantity) || 0;
              return (
                <div key={line.key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <ProductSelect
                      value={line.productId}
                      onChange={(v) => update(line.key, { productId: v })}
                      products={products}
                    />
                    {line.productId ? (
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        On hand {have}
                        {delta !== 0 ? ` → ${have + delta}` : ""}
                        {have + delta < 0 ? " (below zero, not allowed)" : ""}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    className="w-24 text-right"
                    inputMode="numeric"
                    placeholder="±0"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => remove(line.key)}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="justify-self-start" onClick={add}>
              <Plus /> Add line
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adj-notes">Notes</Label>
            <Input
              id="adj-notes"
              placeholder="Count sheet #14, aisle C"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Applying…" : "Apply adjustment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function NewTransferDialog({
  products,
  warehouses,
  levels,
}: {
  products: ProductOption[];
  warehouses: WarehouseOption[];
  levels: LevelMap;
}) {
  const [open, setOpen] = useState(false);
  const [fromWarehouseId, setFromWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? "",
  );
  const [toWarehouseId, setToWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const { lines, update, add, remove, reset } = useDocLines();
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await createTransfer({
        fromWarehouseId,
        toWarehouseId,
        notes: notes || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity) || 0,
        })),
      });
      if (result.ok) {
        toast.success("Transfer complete, both warehouses updated");
        setOpen(false);
        reset();
        setNotes("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const warehouseSelect = (
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    excludeId?: string,
  ) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {warehouses
          .filter((w) => w.id !== excludeId)
          .map((w) => (
            <SelectItem key={w.id} value={w.id}>
              {w.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ArrowLeftRight /> New transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New warehouse transfer</DialogTitle>
          <DialogDescription>
            Moves stock between warehouses in one step, a paired out/in in the
            ledger under the same reference.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>From</Label>
              {warehouseSelect(fromWarehouseId, setFromWarehouseId, "Source", toWarehouseId)}
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              {warehouseSelect(toWarehouseId, setToWarehouseId, "Destination", fromWarehouseId)}
            </div>
          </div>
          <div className="grid gap-2">
            {lines.map((line) => {
              const have = levels[`${line.productId}|${fromWarehouseId}`] ?? 0;
              const qty = Number(line.quantity) || 0;
              return (
                <div key={line.key} className="flex items-start gap-2">
                  <div className="flex-1">
                    <ProductSelect
                      value={line.productId}
                      onChange={(v) => update(line.key, { productId: v })}
                      products={products}
                    />
                    {line.productId ? (
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {have} at source
                        {qty > 0 ? ` → ${have - qty} after` : ""}
                        {qty > have ? " (not enough)" : ""}
                      </p>
                    ) : null}
                  </div>
                  <Input
                    className="w-24 text-right"
                    inputMode="numeric"
                    placeholder="0"
                    value={line.quantity}
                    onChange={(e) => update(line.key, { quantity: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => remove(line.key)}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="justify-self-start" onClick={add}>
              <Plus /> Add line
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trf-notes">Notes</Label>
            <Input
              id="trf-notes"
              placeholder="Rebalancing ahead of Q4 promo"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Transferring…" : "Transfer stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
