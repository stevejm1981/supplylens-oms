"use client";

// The packing-bench UI. Four stages: queue → pick (scan to verify) → pack →
// label & confirm. All writes go through the standard despatch actions via
// the thin wrappers in ./actions, this component owns zero business rules.

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Minus,
  PackageCheck,
  Plus,
  Printer,
  ScanBarcode,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelPicking,
  confirmStationDespatch,
  finishPicking,
  startPicking,
  type StationDespatchLine,
} from "./actions";

export interface QueueLine {
  orderLineId: string;
  sku: string;
  name: string;
  isBundle: boolean;
  uomCode: string | null;
  unitsPerUom: number;
  productBarcode: string | null;
  outerBarcode: string | null;
  unitWeightGrams: number;
  outstanding: number;
}

export interface QueueOrder {
  id: string;
  reference: string;
  customer: string;
  channel: string;
  isPreOrder: boolean;
  requiredLabel: string | null; // pre-formatted server-side (hydration-safe)
  shippingService: string | null;
  deliveryAddress: string | null;
  deliveryContact: string | null;
  shippingInstructions: string | null;
  giftMessage: string | null;
  resumeStatus: string | null;
  lines: QueueLine[];
}

type Stage = "queue" | "picking" | "pack" | "label";

export function Station({ queue }: { queue: QueueOrder[] }) {
  const [stage, setStage] = useState<Stage>("queue");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [order, setOrder] = useState<QueueOrder | null>(null);
  const [despatchId, setDespatchId] = useState("");
  const [despatchRef, setDespatchRef] = useState("");
  const [targets, setTargets] = useState<Map<string, StationDespatchLine>>(new Map());
  const [picked, setPicked] = useState<Map<string, number>>(new Map());
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [parcels, setParcels] = useState("1");
  const [weightKg, setWeightKg] = useState("");
  const [service, setService] = useState("");
  const [tracking, setTracking] = useState("");
  const [pending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const lineByOrderLine = useMemo(
    () => new Map(order?.lines.map((l) => [l.orderLineId, l]) ?? []),
    [order],
  );

  function reset() {
    setStage("queue");
    setOrder(null);
    setDespatchId("");
    setDespatchRef("");
    setTargets(new Map());
    setPicked(new Map());
    setScan("");
    setFlash(null);
    router.refresh();
  }

  function begin(o: QueueOrder) {
    startTransition(async () => {
      const result = await startPicking(o.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setOrder(o);
      setDespatchId(result.despatchId);
      setDespatchRef(result.reference);
      setTargets(new Map(result.lines.map((l) => [l.orderLineId, l])));
      if (result.status === "PICKED") {
        // Resumed a despatch already marked picked, straight to packing.
        setPicked(new Map(result.lines.map((l) => [l.orderLineId, l.pickedQty])));
        prefillPack(o, new Map(result.lines.map((l) => [l.orderLineId, l.pickedQty])));
        setStage("pack");
      } else {
        setPicked(new Map(result.lines.map((l) => [l.orderLineId, 0])));
        setStage("picking");
        setTimeout(() => scanRef.current?.focus(), 50);
      }
    });
  }

  function targetFor(orderLineId: string): number {
    return targets.get(orderLineId)?.quantity ?? 0;
  }

  function adjust(orderLineId: string, delta: number) {
    setPicked((prev) => {
      const next = new Map(prev);
      const target = targetFor(orderLineId);
      next.set(
        orderLineId,
        Math.max(0, Math.min(target, (next.get(orderLineId) ?? 0) + delta)),
      );
      return next;
    });
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim();
    setScan("");
    if (!code || !order) return;
    const upper = code.toUpperCase();
    const match = order.lines.find(
      (l) =>
        l.productBarcode === code ||
        l.outerBarcode === code ||
        l.sku === upper,
    );
    if (!match) {
      setFlash({ kind: "bad", text: `✕ ${code}, not on this order` });
      return;
    }
    const current = picked.get(match.orderLineId) ?? 0;
    if (current >= targetFor(match.orderLineId)) {
      setFlash({ kind: "bad", text: `✕ ${match.sku}, line already complete` });
      return;
    }
    adjust(match.orderLineId, 1);
    const unit = match.uomCode ? `1 × ${match.uomCode} (${match.unitsPerUom} ea)` : "1 ea";
    setFlash({ kind: "ok", text: `✓ ${match.sku}, ${unit}` });
  }

  const totalTarget = [...targets.values()].reduce((s, t) => s + t.quantity, 0);
  const totalPicked = [...picked.values()].reduce((s, q) => s + q, 0);
  const allPicked = totalPicked === totalTarget && totalTarget > 0;

  function prefillPack(o: QueueOrder, picks: Map<string, number>) {
    const grams = [...picks.entries()].reduce((s, [orderLineId, qty]) => {
      const line = o.lines.find((l) => l.orderLineId === orderLineId);
      return s + qty * (line?.unitWeightGrams ?? 0);
    }, 0);
    setWeightKg(grams > 0 ? (grams / 1000).toFixed(2) : "");
    setService(o.shippingService ?? "DPD Next Day");
    setParcels("1");
  }

  function toPack() {
    if (!order) return;
    startTransition(async () => {
      const result = await finishPicking(
        despatchId,
        [...targets.values()].map((t) => ({
          despatchLineId: t.despatchLineId,
          pickedQty: picked.get(t.orderLineId) ?? 0,
        })),
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      prefillPack(order, picked);
      setStage("pack");
    });
  }

  function generateLabel() {
    // Mock: a realistic DPD-style number. The production build calls DPD's
    // shipping API here with the customer's own account credentials.
    setTracking(`1550${String(Date.now()).slice(-9)}`);
    setStage("label");
  }

  function confirm() {
    startTransition(async () => {
      const result = await confirmStationDespatch(despatchId, {
        shippingService: service,
        trackingNumber: tracking,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${despatchRef} despatched, stock deducted, COGS journalled, tracking ${tracking}`,
      );
      reset();
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelPicking(despatchId);
      if (!result.ok) toast.error(result.error);
      reset();
    });
  }

  // ── Queue ─────────────────────────────────────────────────────────────────
  if (stage === "queue" || !order) {
    const toggle = (id: string) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    return (
      <div className="grid gap-3">
        {queue.length > 1 ? (
          <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2.5">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={selected.size === queue.length && queue.length > 0}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(queue.map((o) => o.id)) : new Set())
                }
              />
              Select orders for a batch pick, one consolidated walk, sort at the bench
            </label>
            <Button
              variant="outline"
              size="sm"
              disabled={selected.size === 0}
              onClick={() =>
                window.open(`/picklist/job?orders=${[...selected].join(",")}`, "_blank")
              }
            >
              <Printer className="size-3.5" />
              Print job list{selected.size > 0 ? ` (${selected.size})` : ""}
            </Button>
          </div>
        ) : null}
        {queue.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing waiting to pick, every open order is fully planned.
            </CardContent>
          </Card>
        ) : (
          queue.map((o) => (
            <Card key={o.id}>
              <CardContent className="flex flex-wrap items-center gap-4 py-4">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  aria-label={`Select ${o.reference} for the job list`}
                  checked={selected.has(o.id)}
                  onChange={() => toggle(o.id)}
                />
                <div className="min-w-40">
                  <span className="font-mono text-sm font-semibold">{o.reference}</span>
                  <span className="block text-sm">{o.customer}</span>
                  <span className="block text-xs text-muted-foreground">{o.channel}</span>
                </div>
                <div className="flex-1 text-sm text-muted-foreground">
                  {o.lines.map((l) => (
                    <span key={l.orderLineId} className="mr-3 inline-block whitespace-nowrap font-mono text-xs">
                      {l.sku} ×{l.outstanding}
                      {l.uomCode ? ` ${l.uomCode}` : ""}
                    </span>
                  ))}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {o.requiredLabel ? <>required {o.requiredLabel}</> : null}
                  {o.shippingService ? <span className="block">{o.shippingService}</span> : null}
                </div>
                {o.isPreOrder ? (
                  <Badge className="border-transparent bg-violet-100 text-violet-800">Pre-order</Badge>
                ) : null}
                {o.resumeStatus ? (
                  <Badge className="border-transparent bg-sky-100 text-sky-800">
                    {o.resumeStatus === "PICKED" ? "Picked, pack it" : "Picking in progress"}
                  </Badge>
                ) : null}
                <Button onClick={() => begin(o)} disabled={pending}>
                  <ScanBarcode />
                  {o.resumeStatus ? "Resume" : "Start picking"}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    );
  }

  // ── Picking ───────────────────────────────────────────────────────────────
  if (stage === "picking") {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Picking {order.reference}
            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{despatchRef}</span>
          </CardTitle>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/picklist/${despatchId}`, "_blank")}
            >
              <Printer className="size-3.5" /> Print pick list
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              {totalPicked} / {totalTarget} picked
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={onScan} className="flex items-center gap-2">
            <ScanBarcode className="size-5 text-muted-foreground" />
            <Input
              ref={scanRef}
              autoFocus
              placeholder="Scan a barcode (or type it / the SKU) and press Enter"
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              className="max-w-md font-mono"
            />
            {flash ? (
              <span
                className={`text-sm font-medium ${flash.kind === "ok" ? "text-emerald-700" : "text-rose-600"}`}
              >
                {flash.text}
              </span>
            ) : null}
          </form>

          <div className="grid gap-2">
            {order.lines.map((l) => {
              const target = targetFor(l.orderLineId);
              const qty = picked.get(l.orderLineId) ?? 0;
              const done = qty === target;
              return (
                <div
                  key={l.orderLineId}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    done ? "border-emerald-200 bg-emerald-50/60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs font-medium">{l.sku}</span>
                    {l.uomCode ? (
                      <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-xs">
                        {l.uomCode} · {l.unitsPerUom} ea
                      </span>
                    ) : null}
                    {l.isBundle ? (
                      <span className="ml-2 text-xs text-muted-foreground">bundle</span>
                    ) : null}
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.name}
                      {l.outerBarcode ? ` · outer ${l.outerBarcode}` : l.productBarcode ? ` · ${l.productBarcode}` : ""}
                    </span>
                  </div>
                  <Button variant="outline" size="icon" className="size-7" onClick={() => adjust(l.orderLineId, -1)} disabled={qty === 0}>
                    <Minus className="size-3.5" />
                  </Button>
                  <span className={`w-16 text-center font-semibold tabular-nums ${done ? "text-emerald-700" : ""}`}>
                    {qty} / {target}
                  </span>
                  <Button variant="outline" size="icon" className="size-7" onClick={() => adjust(l.orderLineId, 1)} disabled={qty >= target}>
                    <Plus className="size-3.5" />
                  </Button>
                  {done ? <Check className="size-4 text-emerald-600" /> : <span className="size-4" />}
                </div>
              );
            })}
          </div>

          {order.shippingInstructions ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ⚠ {order.shippingInstructions}
            </p>
          ) : null}

          <div className="flex justify-between">
            <Button variant="ghost" onClick={cancel} disabled={pending}>
              <ArrowLeft /> Cancel picking
            </Button>
            <Button onClick={toPack} disabled={pending || totalPicked === 0}>
              <PackageCheck />
              {allPicked ? "All picked, pack it" : `Short-pick ${totalPicked} of ${totalTarget}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Pack ──────────────────────────────────────────────────────────────────
  if (stage === "pack") {
    return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">
            Pack {order.reference}
            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{despatchRef}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {order.giftMessage ? (
            <p className="rounded-md bg-violet-50 px-3 py-2 text-xs text-violet-800">
              🎁 Gift message, include the card: “{order.giftMessage}”
            </p>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="parcels">Parcels</Label>
              <Input id="parcels" inputMode="numeric" value={parcels} onChange={(e) => setParcels(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input id="weight" inputMode="decimal" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="service">Service</Label>
              <Input id="service" value={service} onChange={(e) => setService(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Weight pre-filled from the picked items’ catalogue weights, override with the scale reading.
          </p>
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStage("picking")} disabled={pending || order.resumeStatus === "PICKED"}>
              <ArrowLeft /> Back to picking
            </Button>
            <Button onClick={generateLabel} disabled={pending}>
              <Truck /> Generate DPD label
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Label & confirm ───────────────────────────────────────────────────────
  return (
    <div className="grid max-w-xl gap-4">
      <div className="overflow-hidden rounded-xl border-2 border-slate-300 bg-white text-slate-900 shadow-sm">
        <div className="flex items-center justify-between bg-[#DC0032] px-4 py-2 text-white">
          <span className="text-xl font-black italic tracking-tight">dpd</span>
          <span className="text-xs font-semibold uppercase">{service || "DPD Next Day"}</span>
        </div>
        <div className="grid gap-3 p-4">
          <div className="flex justify-between gap-4">
            <div className="text-sm">
              <p className="text-[10px] font-semibold uppercase text-slate-500">Deliver to</p>
              <p className="whitespace-pre-line font-medium">
                {order.customer}
                {"\n"}
                {order.deliveryAddress ?? ""}
              </p>
              {order.deliveryContact ? (
                <p className="text-xs text-slate-500">{order.deliveryContact}</p>
              ) : null}
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Ref {order.reference}</p>
              <p>{despatchRef}</p>
              <p>
                {parcels || "1"} parcel{(Number(parcels) || 1) === 1 ? "" : "s"} · {weightKg || "?"} kg
              </p>
            </div>
          </div>
          <div
            aria-hidden
            className="h-16 w-full"
            style={{
              background:
                "repeating-linear-gradient(90deg,#0f172a 0 3px,transparent 3px 5px,#0f172a 5px 6px,transparent 6px 10px,#0f172a 10px 12px,transparent 12px 15px)",
            }}
          />
          <p className="text-center font-mono text-lg font-semibold tracking-widest">{tracking}</p>
        </div>
        <p className="border-t bg-slate-50 px-4 py-1.5 text-center text-[10px] text-slate-400">
          DEMO LABEL, production calls DPD’s shipping API on the customer’s own business account
        </p>
      </div>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => setStage("pack")} disabled={pending}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={confirm} disabled={pending}>
          <Check /> {pending ? "Confirming…" : "Confirm despatch"}
        </Button>
      </div>
    </div>
  );
}
