"use client";

// The receiving-door UI, the inbound sibling of the Despatch Station. Two
// stages: queue → receive. All writes go through receiveGoodsReceipt, the
// same action the PO page's receive-all button uses; this component owns
// zero business rules.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, PackageCheck, ScanBarcode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { receiveGoodsReceipt } from "../purchase-orders/actions";

export interface InboundLine {
  poLineId: string;
  sku: string;
  name: string;
  barcode: string | null;
  batchTracked: boolean;
  ordered: number;
  received: number;
  outstanding: number;
}

export interface InboundPo {
  id: string;
  reference: string;
  supplier: string;
  status: string;
  expectedLabel: string | null; // pre-formatted server-side (hydration-safe)
  containerRef: string | null;
  deliveries: number;
  lines: InboundLine[];
}

interface LineEntry {
  qty: string;
  batchRef: string;
  bestBefore: string;
}

export function GoodsInStation({
  queue,
  warehouses,
}: {
  queue: InboundPo[];
  warehouses: { id: string; name: string; isDefault: boolean }[];
}) {
  const [po, setPo] = useState<InboundPo | null>(null);
  const [warehouseId, setWarehouseId] = useState(
    warehouses.find((w) => w.isDefault)?.id ?? warehouses[0]?.id ?? "",
  );
  const [entries, setEntries] = useState<Map<string, LineEntry>>(new Map());
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function begin(next: InboundPo) {
    setPo(next);
    // The common case IS the full delivery: quantities prefill to what is
    // outstanding, the receiver only edits the lines that came up short.
    setEntries(
      new Map(
        next.lines.map((l) => [
          l.poLineId,
          { qty: String(l.outstanding), batchRef: "", bestBefore: "" },
        ]),
      ),
    );
    setScan("");
    setFlash(null);
    setHighlight(null);
    setTimeout(() => scanRef.current?.focus(), 50);
  }

  function reset() {
    setPo(null);
    setEntries(new Map());
    setFlash(null);
    setHighlight(null);
    router.refresh();
  }

  function setEntry(poLineId: string, patch: Partial<LineEntry>) {
    setEntries((prev) => {
      const next = new Map(prev);
      const current = next.get(poLineId) ?? { qty: "0", batchRef: "", bestBefore: "" };
      next.set(poLineId, { ...current, ...patch });
      return next;
    });
  }

  function onScan(e: React.FormEvent) {
    e.preventDefault();
    const code = scan.trim();
    setScan("");
    if (!code || !po) return;
    const upper = code.toUpperCase();
    const match = po.lines.find((l) => l.barcode === code || l.sku === upper);
    if (!match) {
      setFlash({ kind: "bad", text: `✕ ${code}, not on this order` });
      setHighlight(null);
      return;
    }
    setFlash({ kind: "ok", text: `✓ ${match.sku}, ${match.name}` });
    setHighlight(match.poLineId);
    const entry = entries.get(match.poLineId);
    if (!entry || entry.qty === "0" || entry.qty === "") {
      setEntry(match.poLineId, { qty: String(match.outstanding) });
    }
    document.getElementById(`grn-line-${match.poLineId}`)?.scrollIntoView({ block: "center" });
  }

  function submit() {
    if (!po) return;
    const lines = po.lines
      .map((l) => {
        const entry = entries.get(l.poLineId);
        return {
          poLineId: l.poLineId,
          quantity: Number.parseInt(entry?.qty || "0", 10) || 0,
          batchRef: entry?.batchRef.trim() || null,
          bestBefore: entry?.bestBefore || null,
        };
      })
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      toast.error("Enter a quantity on at least one line");
      return;
    }
    const missingBatch = po.lines.filter(
      (l) =>
        l.batchTracked &&
        lines.some((x) => x.poLineId === l.poLineId) &&
        !lines.find((x) => x.poLineId === l.poLineId)?.batchRef,
    );
    if (missingBatch.length > 0) {
      toast.error(
        `Enter a batch for: ${missingBatch.map((l) => l.sku).join(", ")}`,
      );
      return;
    }
    startTransition(async () => {
      const result = await receiveGoodsReceipt({ poId: po.id, warehouseId, lines });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Delivery received against ${po.reference}`);
      reset();
    });
  }

  if (!po) {
    return (
      <div className="grid gap-3">
        {queue.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nothing inbound. Placed purchase orders appear here the moment they exist.
            </CardContent>
          </Card>
        ) : null}
        {queue.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{p.reference}</span>
                  <StatusBadge status={p.status} />
                  {p.deliveries > 0 ? (
                    <Badge variant="secondary">
                      {p.deliveries} deliver{p.deliveries === 1 ? "y" : "ies"} so far
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-sm text-muted-foreground">
                  {p.supplier}
                  {p.containerRef ? ` · ${p.containerRef}` : ""}
                  {p.expectedLabel ? ` · expected ${p.expectedLabel}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.lines.length} line{p.lines.length === 1 ? "" : "s"} outstanding ·{" "}
                  {p.lines.reduce((s, l) => s + l.outstanding, 0)} units to receive
                </p>
              </div>
              <Button size="lg" onClick={() => begin(p)}>
                <PackageCheck className="mr-1 size-4" /> Receive
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center gap-3 space-y-0">
        <Button variant="ghost" size="icon" onClick={reset} disabled={pending}>
          <ArrowLeft className="size-4" />
        </Button>
        <CardTitle className="text-base">
          <span className="font-mono">{po.reference}</span>
          <span className="ml-2 font-normal text-muted-foreground">{po.supplier}</span>
        </CardTitle>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="grn-warehouse" className="text-xs text-muted-foreground">
            Into
          </Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger id="grn-warehouse" className="h-9 w-48">
              <SelectValue placeholder="Warehouse" />
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
      </CardHeader>
      <CardContent className="grid gap-4">
        <form onSubmit={onScan} className="flex items-center gap-3">
          <ScanBarcode className="size-5 text-muted-foreground" />
          <Input
            ref={scanRef}
            value={scan}
            onChange={(e) => setScan(e.target.value)}
            placeholder="Scan a barcode or type a SKU, Enter jumps to the line"
            className="h-11 text-base"
            autoComplete="off"
          />
          {flash ? (
            <span
              className={`whitespace-nowrap text-sm font-medium ${
                flash.kind === "ok" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {flash.text}
            </span>
          ) : null}
        </form>

        <div className="grid gap-2">
          {po.lines.map((l) => {
            const entry = entries.get(l.poLineId) ?? { qty: "0", batchRef: "", bestBefore: "" };
            const qty = Number.parseInt(entry.qty || "0", 10) || 0;
            const complete = qty >= l.outstanding && qty > 0;
            return (
              <div
                key={l.poLineId}
                id={`grn-line-${l.poLineId}`}
                className={`grid gap-2 rounded-lg border px-3 py-2.5 ${
                  highlight === l.poLineId
                    ? "border-teal-400 bg-teal-50/50"
                    : complete
                      ? "border-emerald-200 bg-emerald-50/60"
                      : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-mono text-xs font-medium">{l.sku}</span>
                    {l.batchTracked ? (
                      <Badge variant="secondary" className="ml-2">
                        batch tracked
                      </Badge>
                    ) : null}
                    <span className="block truncate text-xs text-muted-foreground">
                      {l.name}
                      {l.barcode ? ` · ${l.barcode}` : ""}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    ordered {l.ordered} · received {l.received} · outstanding{" "}
                    <span className="font-semibold text-foreground">{l.outstanding}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`qty-${l.poLineId}`} className="text-xs text-muted-foreground">
                      Arrived
                    </Label>
                    <Input
                      id={`qty-${l.poLineId}`}
                      type="number"
                      min={0}
                      value={entry.qty}
                      onChange={(e) => setEntry(l.poLineId, { qty: e.target.value })}
                      className="h-10 w-24 text-right text-base font-semibold tabular-nums"
                    />
                    {complete ? <Check className="size-4 text-emerald-600" /> : <span className="size-4" />}
                  </div>
                </div>
                {l.batchTracked ? (
                  <div className="flex flex-wrap items-center gap-3 pl-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`batch-${l.poLineId}`} className="text-xs text-muted-foreground">
                        Batch
                      </Label>
                      <Input
                        id={`batch-${l.poLineId}`}
                        value={entry.batchRef}
                        onChange={(e) => setEntry(l.poLineId, { batchRef: e.target.value })}
                        placeholder="e.g. LOT-2609"
                        className="h-9 w-40 font-mono text-sm"
                        autoComplete="off"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`bbe-${l.poLineId}`} className="text-xs text-muted-foreground">
                        Best before
                      </Label>
                      <Input
                        id={`bbe-${l.poLineId}`}
                        type="date"
                        value={entry.bestBefore}
                        onChange={(e) => setEntry(l.poLineId, { bestBefore: e.target.value })}
                        className="h-9 w-40 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={reset} disabled={pending}>
            Back to queue
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            <PackageCheck className="mr-1 size-4" />
            {pending ? "Receiving…" : "Receive delivery"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
