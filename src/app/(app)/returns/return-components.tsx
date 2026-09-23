"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Inbox, PackageX, Plus, Send, Trash2 } from "lucide-react";

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
import { formatPence, parsePoundsToPence } from "@/lib/money";
import {
  createSupplierReturn,
  deleteCustomerReturn,
  deleteSupplierReturn,
  receiveCustomerReturn,
  sendSupplierReturn,
} from "./actions";

type Result = { ok: boolean } & { error?: string };

function useRun() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<Result>, success: string, onDone?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        onDone?.();
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  return { pending, run };
}

// ── Receive an RMA with restock / write-off triage ─────────────────────────
export interface RmaLineView {
  id: string;
  sku: string;
  quantity: number;
}

export function ReceiveRmaDialog({
  rmaId,
  reference,
  lines,
}: {
  rmaId: string;
  reference: string;
  lines: RmaLineView[];
}) {
  const [open, setOpen] = useState(false);
  const [restock, setRestock] = useState<Record<string, string>>({});
  const [writeOff, setWriteOff] = useState<Record<string, string>>({});
  const { pending, run } = useRun();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Inbox /> Receive
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receive {reference}</DialogTitle>
          <DialogDescription>
            Triage each line: restocked units go back into stock and reverse COGS;
            write-offs are binned but still refunded. The credit note raises itself.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="grid grid-cols-[1fr_90px_90px] items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <span>Line</span>
            <span className="text-right">Restock</span>
            <span className="text-right">Write-off</span>
          </div>
          {lines.map((l) => (
            <div key={l.id} className="grid grid-cols-[1fr_90px_90px] items-center gap-2">
              <span>
                <span className="font-mono text-xs font-medium">{l.sku}</span>
                <span className="ml-2 text-xs text-muted-foreground">of {l.quantity}</span>
              </span>
              <Input
                className="h-8 text-right"
                inputMode="numeric"
                value={restock[l.id] ?? String(l.quantity)}
                onChange={(e) => setRestock((p) => ({ ...p, [l.id]: e.target.value }))}
              />
              <Input
                className="h-8 text-right"
                inputMode="numeric"
                placeholder="0"
                value={writeOff[l.id] ?? ""}
                onChange={(e) => setWriteOff((p) => ({ ...p, [l.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  receiveCustomerReturn(
                    rmaId,
                    lines.map((l) => ({
                      returnLineId: l.id,
                      restockQty: Number(restock[l.id] ?? l.quantity) || 0,
                      writeOffQty: Number(writeOff[l.id] ?? 0) || 0,
                    })),
                  ),
                "Return received, credit note raised",
                () => setOpen(false),
              )
            }
          >
            {pending ? "Receiving…" : "Receive & credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RmaRowActions({ rmaId }: { rmaId: string }) {
  const { pending, run } = useRun();
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Cancel return"
      disabled={pending}
      onClick={() => run(() => deleteCustomerReturn(rmaId), "Return cancelled")}
    >
      <Trash2 className="text-muted-foreground" />
    </Button>
  );
}

// ── Supplier returns (RTV) ─────────────────────────────────────────────────
export interface RtvProductOption {
  id: string;
  sku: string;
  name: string;
  supplierId: string | null;
  avgLandedPence: number | null;
}

interface RtvLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string;
}

export function NewSupplierReturnDialog({
  suppliers,
  warehouses,
  products,
}: {
  suppliers: { id: string; name: string }[];
  warehouses: { id: string; name: string; isDefault: boolean }[];
  products: RtvProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<RtvLine[]>([
    { key: 1, productId: "", quantity: "", unitCost: "" },
  ]);
  const { pending, run } = useRun();

  const supplierProducts = products.filter(
    (p) => !supplierId || p.supplierId === supplierId,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PackageX /> New supplier return
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New supplier return (RTV)</DialogTitle>
          <DialogDescription>
            Send goods back to a supplier, stock leaves when you mark it sent, and
            the expected supplier credit is recorded.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>From warehouse</Label>
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
          {lines.map((line) => (
            <div key={line.key} className="grid grid-cols-[1fr_80px_110px_36px] items-center gap-2">
              <ProductCombobox
                products={supplierProducts}
                value={line.productId}
                onChange={(v) => {
                  const p = products.find((x) => x.id === v);
                  setLines((prev) =>
                    prev.map((l) =>
                      l.key === line.key
                        ? {
                            ...l,
                            productId: v,
                            unitCost:
                              l.unitCost ||
                              (p?.avgLandedPence != null
                                ? (p.avgLandedPence / 100).toFixed(2)
                                : ""),
                          }
                        : l,
                    ),
                  );
                }}
                placeholder="Product"
              />
              <Input
                className="h-9 text-right"
                inputMode="numeric"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)),
                  )
                }
              />
              <Input
                className="h-9 text-right"
                inputMode="decimal"
                placeholder="Unit £"
                value={line.unitCost}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l) => (l.key === line.key ? { ...l, unitCost: e.target.value } : l)),
                  )
                }
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remove line"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
              >
                <Trash2 className="text-muted-foreground" />
              </Button>
            </div>
          ))}
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { key: Math.max(...prev.map((l) => l.key), 0) + 1, productId: "", quantity: "", unitCost: "" },
                ])
              }
            >
              <Plus /> Add line
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rtv-reason">Reason</Label>
            <Input
              id="rtv-reason"
              placeholder="Damaged batch on arrival"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  createSupplierReturn({
                    supplierId,
                    warehouseId,
                    reason: reason || null,
                    lines: lines.map((l) => ({
                      productId: l.productId,
                      quantity: Number(l.quantity) || 0,
                      unitCostPence: parsePoundsToPence(l.unitCost) ?? 0,
                    })),
                  }),
                "Supplier return created as draft",
                () => setOpen(false),
              )
            }
          >
            {pending ? "Creating…" : "Create return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RtvRowActions({ rtvId, status }: { rtvId: string; status: string }) {
  const { pending, run } = useRun();
  if (status !== "DRAFT") return null;
  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        disabled={pending}
        onClick={() => run(() => sendSupplierReturn(rtvId), "Sent, stock deducted")}
      >
        <Send /> Mark sent
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Delete supplier return"
        disabled={pending}
        onClick={() => run(() => deleteSupplierReturn(rtvId), "Supplier return deleted")}
      >
        <Trash2 className="text-muted-foreground" />
      </Button>
    </div>
  );
}

export function formatMaybePence(pence: number): string {
  return formatPence(pence);
}
