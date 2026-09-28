"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, PackagePlus, Pencil, Send, Trash2 } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RateSuggestion } from "@/components/rate-suggestion";
import { cardsForService, type RateCard } from "@/lib/engine/carrier-rates";
import {
  createDespatch,
  deleteDespatch,
  despatchDespatch,
  markDespatchPicked,
  setExpectedCarriage,
} from "../actions";

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

// ── Create a despatch from the order's outstanding lines ───────────────────
export interface OutstandingLine {
  orderLineId: string;
  sku: string;
  name: string;
  outstanding: number;
}

export function CreateDespatchDialog({
  orderId,
  lines,
}: {
  orderId: string;
  lines: OutstandingLine[];
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>({});
  const { pending, run } = useRun();
  const creatable = lines.filter((l) => l.outstanding > 0);
  if (creatable.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PackagePlus /> Create despatch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create despatch</DialogTitle>
          <DialogDescription>
            One shipment against this order, leave the defaults for everything
            outstanding, or lower quantities to split the order.
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Line</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-24 text-right">This despatch</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creatable.map((l) => (
                <TableRow key={l.orderLineId}>
                  <TableCell className="pl-4">
                    <span className="font-mono text-xs font-medium">{l.sku}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {l.outstanding}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-right"
                      inputMode="numeric"
                      value={qty[l.orderLineId] ?? String(l.outstanding)}
                      onChange={(e) =>
                        setQty((prev) => ({ ...prev, [l.orderLineId]: e.target.value }))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  createDespatch(
                    orderId,
                    creatable.map((l) => ({
                      orderLineId: l.orderLineId,
                      quantity: Number(qty[l.orderLineId] ?? l.outstanding) || 0,
                    })),
                  ),
                "Despatch created, picking",
                () => setOpen(false),
              )
            }
          >
            {pending ? "Creating…" : "Create despatch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Per-despatch actions: mark picked → despatch ───────────────────────────
export interface DespatchView {
  id: string;
  status: string;
  shippingService: string | null;
  lines: { id: string; sku: string; quantity: number; pickedQty: number }[];
}

export function DespatchRowActions({
  despatch,
  rateCards = [],
  postcode = null,
}: {
  despatch: DespatchView;
  rateCards?: RateCard[];
  postcode?: string | null;
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [service, setService] = useState(despatch.shippingService ?? "");
  const [tracking, setTracking] = useState("");
  const [carriage, setCarriage] = useState("");
  const { pending, run } = useRun();

  if (despatch.status === "DESPATCHED") return null;

  return (
    <div className="flex items-center gap-1.5">
      {despatch.status === "PICKING" ? (
        <Dialog open={pickOpen} onOpenChange={setPickOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <ClipboardCheck /> Mark picked
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Confirm picked quantities</DialogTitle>
              <DialogDescription>
                Short-pick by lowering a quantity, the shortfall stays outstanding
                on the order.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {despatch.lines.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-mono text-xs font-medium">{l.sku}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">of {l.quantity}</span>
                    <Input
                      className="h-8 w-20 text-right"
                      inputMode="numeric"
                      value={picked[l.id] ?? String(l.quantity)}
                      onChange={(e) =>
                        setPicked((prev) => ({ ...prev, [l.id]: e.target.value }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      markDespatchPicked(
                        despatch.id,
                        despatch.lines.map((l) => ({
                          despatchLineId: l.id,
                          pickedQty: Number(picked[l.id] ?? l.quantity) || 0,
                        })),
                      ),
                    "Marked picked",
                    () => setPickOpen(false),
                  )
                }
              >
                {pending ? "Saving…" : "Confirm picked"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {despatch.status === "PICKED" ? (
        <Dialog open={shipOpen} onOpenChange={setShipOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Send /> Despatch
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Despatch shipment</DialogTitle>
              <DialogDescription>
                Deducts the picked quantities from stock and locks in COGS at landed
                cost.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor={`svc-${despatch.id}`}>Shipping service</Label>
                <Input
                  id={`svc-${despatch.id}`}
                  placeholder="DPD Next Day"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`trk-${despatch.id}`}>Tracking number</Label>
                <Input
                  id={`trk-${despatch.id}`}
                  placeholder="15501234567890"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`car-${despatch.id}`}>Carriage cost (£, what the carrier charges us)</Label>
                <Input
                  id={`car-${despatch.id}`}
                  inputMode="decimal"
                  placeholder="45.00"
                  value={carriage}
                  onChange={(e) => setCarriage(e.target.value)}
                />
                <RateSuggestion
                  cards={cardsForService(rateCards, service)}
                  postcode={postcode}
                  onUse={(pence) => setCarriage((pence / 100).toFixed(2))}
                />
                <p className="text-xs text-muted-foreground">
                  Optional. Accrues the expected cost to serve; the carrier&apos;s
                  invoice later matches against it.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      despatchDespatch(despatch.id, {
                        shippingService: service,
                        trackingNumber: tracking,
                        expectedCarriagePence: carriage.trim()
                          ? Math.round(Number.parseFloat(carriage) * 100) || null
                          : null,
                      }),
                    "Despatched, stock deducted",
                    () => setShipOpen(false),
                  )
                }
              >
                {pending ? "Despatching…" : "Despatch"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      <Button
        size="icon"
        variant="ghost"
        aria-label="Cancel despatch"
        disabled={pending}
        onClick={() => run(() => deleteDespatch(despatch.id), "Despatch cancelled")}
      >
        <Trash2 className="text-muted-foreground" />
      </Button>
    </div>
  );
}

// ── Expected carriage on a confirmed despatch ───────────────────────────────
// Sets or corrects the accrual after the fact (the rate arrived late, or a
// hand correction). The accrual DELTA journals automatically; blocked once
// a carrier invoice has matched, corrections then belong on the invoice.
export function CarriageDialog({
  despatchId,
  expectedCarriagePence,
}: {
  despatchId: string;
  expectedCarriagePence: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(
    expectedCarriagePence != null ? (expectedCarriagePence / 100).toFixed(2) : "",
  );
  const { pending, run } = useRun();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Carriage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Expected carriage cost</DialogTitle>
          <DialogDescription>
            What the carrier is expected to charge for this consignment. The
            accrual adjusts by the difference; clear it to release the accrual.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="carriage-pounds">Carriage cost (£)</Label>
          <Input
            id="carriage-pounds"
            inputMode="decimal"
            placeholder="45.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => {
              const pence =
                value.trim() === "" ? null : Math.round(Number(value) * 100);
              if (pence !== null && (!Number.isFinite(pence) || pence < 0)) {
                toast.error("Enter an amount like 45.00, or clear the field");
                return;
              }
              run(
                () => setExpectedCarriage(despatchId, pence),
                "Expected carriage updated",
                () => setOpen(false),
              );
            }}
          >
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
