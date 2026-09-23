"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  allocateInvoice,
  type AllocationMethod,
} from "@/lib/engine/landed-cost";
import { formatPence, formatPercent, parsePoundsToPence } from "@/lib/money";
import { createCostInvoice } from "../actions";

export interface PoOption {
  id: string;
  reference: string;
  supplierName: string;
  containerRef: string | null;
  lines: {
    id: string;
    sku: string;
    quantity: number;
    unitCostPence: number;
    unitWeightGrams: number;
  }[];
}

const COST_TYPES = [
  ["FREIGHT", "Freight"],
  ["DUTY", "Duty"],
  ["INSURANCE", "Insurance"],
  ["HANDLING", "Handling"],
  ["OTHER", "Other"],
] as const;

export function InvoiceForm({ pos }: { pos: PoOption[] }) {
  const [reference, setReference] = useState("");
  const [vendor, setVendor] = useState("");
  const [type, setType] = useState("FREIGHT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<AllocationMethod>("VALUE");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [selectedPoIds, setSelectedPoIds] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Group POs by container so the multi-PO container case is one click away.
  const grouped = useMemo(() => {
    const byContainer = new Map<string, PoOption[]>();
    for (const po of pos) {
      const key = po.containerRef ?? "";
      byContainer.set(key, [...(byContainer.get(key) ?? []), po]);
    }
    return [...byContainer.entries()].sort((a, b) =>
      (b[0] || "").localeCompare(a[0] || ""),
    );
  }, [pos]);

  const amountPence = parsePoundsToPence(amount) ?? 0;
  const selectedLines = useMemo(
    () =>
      pos
        .filter((po) => selectedPoIds.includes(po.id))
        .flatMap((po) =>
          po.lines.map((l) => ({ ...l, poReference: po.reference })),
        ),
    [pos, selectedPoIds],
  );

  const preview = useMemo(() => {
    if (amountPence <= 0 || selectedLines.length === 0) return null;
    const outcome = allocateInvoice(
      amountPence,
      method,
      selectedLines.map((l) => ({
        lineId: l.id,
        quantity: l.quantity,
        unitCostPence: l.unitCostPence,
        unitWeightGrams: l.unitWeightGrams,
      })),
    );
    return outcome;
  }, [amountPence, method, selectedLines]);

  function togglePo(id: string) {
    setSelectedPoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit() {
    startTransition(async () => {
      const result = await createCostInvoice({
        reference,
        vendor,
        type,
        amountPence,
        allocationMethod: method,
        invoiceDate: invoiceDate || null,
        notes: null,
        poIds: selectedPoIds,
      });
      if (result.ok) {
        toast.success("Cost invoice allocated");
        router.push(result.id ? `/cost-invoices/${result.id}` : "/cost-invoices");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                placeholder="MAERSK-88671"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                placeholder="Maersk"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COST_TYPES.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount (£)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="4200.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Allocate by</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as AllocationMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VALUE">Line value</SelectItem>
                  <SelectItem value="QUANTITY">Quantity</SelectItem>
                  <SelectItem value="WEIGHT">Weight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invoiceDate">Invoice date</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {grouped.map(([container, group]) => (
              <div key={container || "no-container"}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {container ? `Container ${container}` : "No container"}
                </p>
                <div className="grid gap-2">
                  {group.map((po) => {
                    const selected = selectedPoIds.includes(po.id);
                    const goods = po.lines.reduce(
                      (s, l) => s + l.quantity * l.unitCostPence,
                      0,
                    );
                    return (
                      <button
                        key={po.id}
                        type="button"
                        onClick={() => togglePo(po.id)}
                        className={`flex items-center justify-between rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                          selected
                            ? "border-primary bg-accent"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <span>
                          <span className="font-mono text-xs font-semibold">
                            {po.reference}
                          </span>
                          <span className="ml-2 text-muted-foreground">
                            {po.supplierName}
                          </span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {po.lines.length} lines · {formatPence(goods)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {pos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No purchase orders yet, create one first.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !preview || !reference || !vendor}
          >
            {pending ? "Allocating…" : "Save & allocate"}
          </Button>
        </div>
      </div>

      <Card className="h-fit xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle className="text-base">Live allocation preview</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {preview?.fallback ? (
            <Alert className="mx-6 mb-3 w-auto border-amber-300 bg-amber-50 text-amber-900">
              <AlertTriangle className="size-4 !text-amber-600" />
              <AlertTitle>Equal split fallback</AlertTitle>
              <AlertDescription>
                The chosen basis is zero for every line (e.g. no weights captured),
                the amount was split equally instead.
              </AlertDescription>
            </Alert>
          ) : null}
          {!preview ? (
            <p className="px-6 pb-2 text-sm text-muted-foreground">
              Enter an amount and pick at least one PO to see the split, penny-exact,
              before saving.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Line</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="pr-6 text-right">Allocated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedLines.map((line) => {
                  const r = preview.results.find((x) => x.lineId === line.id)!;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="pl-6">
                        <span className="font-mono text-xs font-medium">{line.sku}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {line.poReference} · {line.quantity} u
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatPercent(r.share)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        {formatPence(r.amountPence)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">Total</TableCell>
                  <TableCell />
                  <TableCell className="pr-6 text-right font-semibold tabular-nums">
                    {formatPence(
                      preview.results.reduce((s, r) => s + r.amountPence, 0),
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
