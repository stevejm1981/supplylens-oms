"use client";

// The carrier invoice form: header + one line per consignment, each line
// covering one or more despatches. The split maths runs server-side (the
// same allocator that splits freight across PO lines); manual mode sends
// explicit amounts that must sum to the line.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";

import { formatPence } from "@/lib/money";
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
import { createCarrierInvoice, type NewCarrierInvoiceLine } from "../actions";

export interface DespatchOption {
  id: string;
  reference: string;
  orderRef: string;
  customer: string;
  service: string | null;
  tracking: string | null;
  despatchedLabel: string;
  expectedPence: number | null;
  invoicedPence: number;
}

type SplitMethod = "VALUE" | "WEIGHT" | "QUANTITY" | "MANUAL";

interface LineState {
  key: number;
  description: string;
  consignmentRef: string;
  amount: string; // £
  method: SplitMethod;
  despatchIds: string[];
  manual: Record<string, string>; // despatchId → £
}

const emptyLine = (key: number): LineState => ({
  key,
  description: "",
  consignmentRef: "",
  amount: "",
  method: "VALUE",
  despatchIds: [],
  manual: {},
});

const toPence = (s: string) => Math.round(Number.parseFloat(s || "0") * 100) || 0;

export function CarrierInvoiceForm({ despatches }: { despatches: DespatchOption[] }) {
  const [reference, setReference] = useState("");
  const [carrier, setCarrier] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineState[]>([emptyLine(1)]);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const optionById = useMemo(() => new Map(despatches.map((d) => [d.id, d])), [despatches]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return despatches;
    return despatches.filter((d) =>
      [d.reference, d.orderRef, d.customer, d.tracking ?? "", d.service ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [despatches, search]);

  function patch(key: number, p: Partial<LineState>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...p } : l)));
  }
  function toggleDespatch(line: LineState, id: string) {
    const has = line.despatchIds.includes(id);
    patch(line.key, {
      despatchIds: has ? line.despatchIds.filter((x) => x !== id) : [...line.despatchIds, id],
    });
  }

  function submit() {
    const payload: NewCarrierInvoiceLine[] = [];
    for (const l of lines) {
      const amountPence = toPence(l.amount);
      if (amountPence <= 0 && l.despatchIds.length === 0) continue; // untouched row
      if (amountPence <= 0) {
        toast.error("Every charge line needs an amount");
        return;
      }
      if (l.despatchIds.length === 0) {
        toast.error("Pick the despatches each charge line covered");
        return;
      }
      if (l.method === "MANUAL") {
        const allocations = l.despatchIds.map((id) => ({
          despatchId: id,
          amountPence: toPence(l.manual[id] ?? ""),
        }));
        const sum = allocations.reduce((s, a) => s + a.amountPence, 0);
        if (sum !== amountPence) {
          toast.error(
            `Manual amounts total ${formatPence(sum)}, the line is ${formatPence(amountPence)}`,
          );
          return;
        }
        payload.push({
          description: l.description || null,
          consignmentRef: l.consignmentRef || null,
          amountPence,
          allocations,
        });
      } else {
        payload.push({
          description: l.description || null,
          consignmentRef: l.consignmentRef || null,
          amountPence,
          split: { despatchIds: l.despatchIds, method: l.method },
        });
      }
    }
    if (payload.length === 0) {
      toast.error("Add at least one charge line");
      return;
    }
    startTransition(async () => {
      const result = await createCarrierInvoice({
        reference,
        carrier,
        invoiceDate: invoiceDate || null,
        notes: notes || null,
        lines: payload,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Carrier invoice matched, variances journalled");
      router.push("/carrier-invoices");
    });
  }

  const total = lines.reduce((s, l) => s + toPence(l.amount), 0);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ci-ref">Carrier&apos;s invoice number</Label>
            <Input id="ci-ref" placeholder="PW-INV-88231" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ci-carrier">Carrier</Label>
            <Input id="ci-carrier" placeholder="Palletways" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ci-date">Invoice date</Label>
            <Input id="ci-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ci-notes">Notes</Label>
            <Input id="ci-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Charge lines</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="h-9 w-72 pl-8"
              placeholder="Filter despatches: SO, tracking, customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {lines.map((l) => (
            <div key={l.key} className="grid gap-3 rounded-lg border p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_120px_150px_auto]">
                <div className="grid gap-1.5">
                  <Label>Description</Label>
                  <Input
                    placeholder="2 pallets, zone 3"
                    value={l.description}
                    onChange={(e) => patch(l.key, { description: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Consignment ref</Label>
                  <Input
                    placeholder="PW8827741"
                    value={l.consignmentRef}
                    onChange={(e) => patch(l.key, { consignmentRef: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Amount (£)</Label>
                  <Input
                    inputMode="decimal"
                    value={l.amount}
                    onChange={(e) => patch(l.key, { amount: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Split</Label>
                  <Select value={l.method} onValueChange={(v) => patch(l.key, { method: v as SplitMethod })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VALUE">By order value</SelectItem>
                      <SelectItem value="WEIGHT">By weight</SelectItem>
                      <SelectItem value="QUANTITY">Equally</SelectItem>
                      <SelectItem value="MANUAL">Manual amounts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove line"
                    onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="grid max-h-56 gap-1 overflow-y-auto rounded-md border p-2">
                {filtered.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">No despatched shipments match.</p>
                ) : (
                  filtered.map((d) => {
                    const on = l.despatchIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex cursor-pointer flex-wrap items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60 ${on ? "bg-accent" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-primary"
                          checked={on}
                          onChange={() => toggleDespatch(l, d.id)}
                        />
                        <span className="font-mono text-xs font-semibold">{d.orderRef}</span>
                        <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                        <span>{d.customer}</span>
                        <span className="text-xs text-muted-foreground">
                          {d.despatchedLabel}
                          {d.service ? ` · ${d.service}` : ""}
                          {d.tracking ? ` · ${d.tracking}` : ""}
                        </span>
                        <span className="flex-1" />
                        {d.invoicedPence > 0 ? (
                          <Badge variant="secondary">invoiced {formatPence(d.invoicedPence)}</Badge>
                        ) : d.expectedPence ? (
                          <Badge variant="outline">accrued {formatPence(d.expectedPence)}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">no accrual</Badge>
                        )}
                        {on && l.method === "MANUAL" ? (
                          <Input
                            className="h-8 w-24 text-right"
                            inputMode="decimal"
                            placeholder="£"
                            value={l.manual[d.id] ?? ""}
                            onClick={(e) => e.preventDefault()}
                            onChange={(e) =>
                              patch(l.key, { manual: { ...l.manual, [d.id]: e.target.value } })
                            }
                          />
                        ) : null}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setLines((prev) => [...prev, emptyLine(Math.max(...prev.map((x) => x.key)) + 1)])}
            >
              <Plus /> Add line
            </Button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Invoice total <span className="font-semibold tabular-nums text-foreground">{formatPence(total)}</span>
              </span>
              <Button onClick={submit} disabled={pending}>
                {pending ? "Matching…" : "Create and match"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
