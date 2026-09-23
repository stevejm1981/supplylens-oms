"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPence, parsePoundsToPence } from "@/lib/money";
import { orderTotalsPence } from "@/lib/sales";
import { createCreditNote } from "../actions";

export interface CreditableLine {
  orderLineId: string;
  sku: string;
  name: string;
  ordered: number;
  alreadyCredited: number;
  unitPricePence: number;
}

export function CreditDialog({
  salesOrderId,
  lines,
  warehouses,
  defaultWarehouseId,
  taxTreatment = "EXCLUSIVE",
}: {
  salesOrderId: string;
  lines: CreditableLine[];
  warehouses: { id: string; name: string }[];
  defaultWarehouseId: string;
  taxTreatment?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [restock, setRestock] = useState(false);
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [price, setPrice] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const creditable = useMemo(
    () => lines.filter((l) => l.ordered - l.alreadyCredited > 0),
    [lines],
  );

  const net = creditable.reduce((s, l) => {
    const q = Number(qty[l.orderLineId]) || 0;
    const p = parsePoundsToPence(price[l.orderLineId] ?? "") ?? l.unitPricePence;
    return s + q * p;
  }, 0);

  function submit() {
    startTransition(async () => {
      const result = await createCreditNote({
        salesOrderId,
        reason: reason || null,
        restock,
        warehouseId: restock ? warehouseId : null,
        lines: creditable.map((l) => ({
          orderLineId: l.orderLineId,
          quantity: Number(qty[l.orderLineId]) || 0,
          unitPricePence:
            parsePoundsToPence(price[l.orderLineId] ?? "") ?? l.unitPricePence,
        })),
      });
      if (result.ok) {
        toast.success(restock ? "Credit raised, stock returned" : "Credit raised");
        setOpen(false);
        setQty({});
        setPrice({});
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Undo2 /> Create credit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create credit note</DialogTitle>
          <DialogDescription>
            Credit part or all of this invoice. Restock returns the goods to a
            warehouse; a write-off refunds without stock coming back.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Line</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="w-24 text-right">Credit qty</TableHead>
                <TableHead className="w-32 text-right">Unit price (£)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creditable.map((l) => {
                const remaining = l.ordered - l.alreadyCredited;
                return (
                  <TableRow key={l.orderLineId}>
                    <TableCell className="pl-4">
                      <span className="font-mono text-xs font-medium">{l.sku}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{l.name}</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {remaining}
                      {l.alreadyCredited > 0 ? (
                        <span className="ml-1 text-xs">({l.alreadyCredited} credited)</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-right"
                        inputMode="numeric"
                        placeholder="0"
                        value={qty[l.orderLineId] ?? ""}
                        onChange={(e) =>
                          setQty((prev) => ({ ...prev, [l.orderLineId]: e.target.value }))
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-right"
                        inputMode="decimal"
                        value={price[l.orderLineId] ?? (l.unitPricePence / 100).toFixed(2)}
                        onChange={(e) =>
                          setPrice((prev) => ({ ...prev, [l.orderLineId]: e.target.value }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input
              id="reason"
              placeholder="Damaged in transit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="grid content-start gap-2">
            <label className="mt-6 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
              />
              Restock returned goods
            </label>
            {restock ? (
              <Select value={warehouseId} onValueChange={setWarehouseId}>
                <SelectTrigger className="w-full">
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
            ) : null}
          </div>
        </div>

        <DialogFooter className="items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Credit value:{" "}
            <b className="tabular-nums text-foreground">
              {formatPence(orderTotalsPence([{ quantity: 1, unitPricePence: net }], 0, taxTreatment).netPence)}
            </b>{" "}
            net + {formatPence(orderTotalsPence([{ quantity: 1, unitPricePence: net }], 0, taxTreatment).vatPence)} VAT
          </span>
          <Button onClick={submit} disabled={pending || net <= 0}>
            {pending ? "Crediting…" : "Raise credit note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
