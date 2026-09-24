"use client";

// Operator-first production UI. The whole workflow is: pick what to make,
// type one number, press three big buttons over the build's life:
// Plan it, Start build, Finish build. Costing and WIP stay invisible.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Hammer, Play, Plus } from "lucide-react";

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
import { componentsForBuild } from "@/lib/engine/production";
import {
  completeProduction,
  createProductionOrder,
  startProduction,
} from "./actions";

export interface BuildableProduct {
  id: string;
  sku: string;
  name: string;
  outputQty: number; // the recipe's batch yield
  bom: { componentId: string; sku: string; name: string; perUnit: number }[];
}
export interface WarehouseOption {
  id: string;
  name: string;
  isDefault: boolean;
}
/** on-hand keyed `${productId}|${warehouseId}` */
export type LevelMap = Record<string, number>;

export function NewBuildDialog({
  products,
  warehouses,
  levels,
}: {
  products: BuildableProduct[];
  warehouses: WarehouseOption[];
  levels: LevelMap;
}) {
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const planned = Number(qty) || 0;

  function submit() {
    startTransition(async () => {
      const result = await createProductionOrder({
        productId,
        warehouseId,
        plannedQty: planned,
        notes: notes || null,
      });
      if (result.ok) {
        toast.success("Build planned, press Start when the components are on the bench");
        setOpen(false);
        setProductId("");
        setQty("");
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
          <Hammer /> New build
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan a build</DialogTitle>
          <DialogDescription>
            Choose what to make and how many. The parts list fills itself from
            the product&apos;s BOM.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>What are you making?</Label>
            <ProductCombobox
              products={products}
              value={productId}
              onChange={setProductId}
              placeholder="Choose assembled product"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bld-qty">How many?</Label>
              <Input
                id="bld-qty"
                inputMode="numeric"
                className="text-lg font-semibold"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Where?</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
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
          </div>

          {product && planned > 0 ? (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Will use
                {product.outputQty > 1 ? (
                  <span className="ml-2 normal-case tracking-normal">
                    (recipe makes {product.outputQty}
                    {planned % product.outputQty !== 0
                      ? ", partial batch, parts round up"
                      : `, ${planned / product.outputQty} batch${planned / product.outputQty === 1 ? "" : "es"}`}
                    )
                  </span>
                ) : null}
              </p>
              <ul className="grid gap-1 text-sm">
                {product.bom.map((c) => {
                  const need = componentsForBuild(c.perUnit, product.outputQty, planned);
                  const have = levels[`${c.componentId}|${warehouseId}`] ?? 0;
                  const ok = have >= need;
                  return (
                    <li key={c.componentId} className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`}
                      />
                      <span className="font-mono text-xs">{c.sku}</span>
                      <span className="flex-1 truncate text-xs text-muted-foreground">{c.name}</span>
                      <span className={`tabular-nums ${ok ? "" : "font-semibold text-rose-600"}`}>
                        {need} <span className="text-xs text-muted-foreground">of {have}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="bld-notes">Notes</Label>
            <Input
              id="bld-notes"
              placeholder="Batch for the Christmas promo"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || !productId || planned < 1}>
            {pending ? "Planning…" : "Plan build"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StartBuildButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startProduction(id);
          if (result.ok) {
            toast.success("Build started, components are out of stock and in the build");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      <Play className="size-3.5" /> {pending ? "Starting…" : "Start build"}
    </Button>
  );
}

export interface FinishLine {
  lineId: string;
  sku: string;
  name: string;
  plannedQty: number;
}

export function FinishBuildDialog({
  id,
  reference,
  productSku,
  plannedQty,
  lines,
}: {
  id: string;
  reference: string;
  productSku: string;
  plannedQty: number;
  lines: FinishLine[];
}) {
  const [open, setOpen] = useState(false);
  const [made, setMade] = useState(String(plannedQty));
  const [showParts, setShowParts] = useState(false);
  const [used, setUsed] = useState<Record<string, string>>({});
  const [showCosts, setShowCosts] = useState(false);
  const [buildCosts, setBuildCosts] = useState("");
  const [costsNote, setCostsNote] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await completeProduction(id, {
        actualQty: Number(made) || 0,
        lines: lines.map((l) => ({
          lineId: l.lineId,
          actualQty: used[l.lineId] !== undefined ? Number(used[l.lineId]) || 0 : l.plannedQty,
        })),
        overheadPence: Math.round((Number(buildCosts) || 0) * 100),
        overheadNote: costsNote || null,
      });
      if (result.ok) {
        toast.success(`${reference} finished, ${made} x ${productSku} added to stock`);
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
        <Button size="sm">
          <Check className="size-3.5" /> Finish build
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Finish {reference}</DialogTitle>
          <DialogDescription>
            One question: how many good units did you make? Adjust the parts
            used only if something broke or was left over.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fin-made">How many {productSku} did you make?</Label>
            <Input
              id="fin-made"
              inputMode="numeric"
              className="text-2xl font-bold"
              value={made}
              onChange={(e) => setMade(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Planned: {plannedQty}</p>
          </div>

          <button
            type="button"
            className="text-left text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowCosts((v) => !v)}
          >
            {showCosts ? "▾" : "▸"} Add build costs (labour, machine time)
          </button>
          {showCosts ? (
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input
                inputMode="decimal"
                placeholder="£ 0.00"
                value={buildCosts}
                onChange={(e) => setBuildCosts(e.target.value)}
              />
              <Input
                placeholder="e.g. 4 hours assembly labour"
                value={costsNote}
                onChange={(e) => setCostsNote(e.target.value)}
              />
              <p className="col-span-2 text-xs text-muted-foreground">
                Absorbed into the finished unit cost, one honest number, no timesheets.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="text-left text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setShowParts((v) => !v)}
          >
            {showParts ? "▾" : "▸"} Adjust parts used (only if different from plan)
          </button>
          {showParts ? (
            <div className="grid gap-2">
              {lines.map((l) => (
                <div key={l.lineId} className="grid grid-cols-[1fr_90px] items-center gap-2">
                  <span className="min-w-0">
                    <span className="font-mono text-xs font-medium">{l.sku}</span>
                    <span className="ml-2 truncate text-xs text-muted-foreground">{l.name}</span>
                  </span>
                  <Input
                    className="h-8 text-right"
                    inputMode="numeric"
                    value={used[l.lineId] ?? String(l.plannedQty)}
                    onChange={(e) => setUsed((p) => ({ ...p, [l.lineId]: e.target.value }))}
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Extra parts come out of stock; leftovers go back. Either way the
                finished cost stays honest.
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={pending || (Number(made) || 0) < 1}>
            {pending ? "Finishing…" : "Finish build"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BuildRowDelete({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-muted-foreground hover:text-destructive"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { deleteProductionOrder } = await import("./actions");
          const result = await deleteProductionOrder(id);
          if (result.ok) {
            toast.success("Draft build deleted");
            router.refresh();
          } else {
            toast.error(result.error);
          }
        })
      }
    >
      Delete
    </Button>
  );
}
