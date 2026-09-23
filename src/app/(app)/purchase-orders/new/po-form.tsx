"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatPence, parsePoundsToPence } from "@/lib/money";
import { createPurchaseOrder } from "../actions";

export interface ProductOption {
  id: string;
  sku: string;
  name: string;
  baseCostPence: number;
}

interface EditableLine {
  key: number;
  productId: string;
  quantity: string;
  unitCost: string; // pounds, as typed
}

export function PoForm({
  suppliers,
  products,
}: {
  suppliers: { id: string; name: string }[];
  products: ProductOption[];
}) {
  const [supplierId, setSupplierId] = useState("");
  const [containerRef, setContainerRef] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([
    { key: 1, productId: "", quantity: "", unitCost: "" },
  ]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function updateLine(key: number, patch: Partial<EditableLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // Default the unit cost from the product's base cost on first pick.
        if (patch.productId && !l.unitCost) {
          const p = productById.get(patch.productId);
          if (p && p.baseCostPence > 0) {
            next.unitCost = (p.baseCostPence / 100).toFixed(2);
          }
        }
        return next;
      }),
    );
  }

  const total = lines.reduce((s, l) => {
    const pence = parsePoundsToPence(l.unitCost) ?? 0;
    return s + (Number(l.quantity) || 0) * pence;
  }, 0);

  function submit() {
    startTransition(async () => {
      const result = await createPurchaseOrder({
        supplierId,
        containerRef: containerRef || null,
        expectedDate: expectedDate || null,
        notes: notes || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity) || 0,
          unitCostPence: parsePoundsToPence(l.unitCost) ?? 0,
        })),
      });
      if (result.ok) {
        toast.success("Purchase order created");
        router.push(result.id ? `/purchase-orders/${result.id}` : "/purchase-orders");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
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
            <Label htmlFor="containerRef">Container ref</Label>
            <Input
              id="containerRef"
              placeholder="MSCU-4821907"
              value={containerRef}
              onChange={(e) => setContainerRef(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="expectedDate">Expected</Label>
            <Input
              id="expectedDate"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={1}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Lines</CardTitle>
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
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Product</TableHead>
                <TableHead className="w-28 text-right">Qty</TableHead>
                <TableHead className="w-36 text-right">Unit cost (£)</TableHead>
                <TableHead className="w-32 text-right">Line total</TableHead>
                <TableHead className="w-14 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const pence = parsePoundsToPence(line.unitCost) ?? 0;
                const lineTotal = (Number(line.quantity) || 0) * pence;
                return (
                  <TableRow key={line.key}>
                    <TableCell className="pl-6">
                      <ProductCombobox
                        products={products}
                        value={line.productId}
                        onChange={(v) => updateLine(line.key, { productId: v })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.key, { unitCost: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPence(lineTotal)}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove line"
                        disabled={lines.length === 1}
                        onClick={() =>
                          setLines((prev) => prev.filter((l) => l.key !== line.key))
                        }
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-6 font-medium">Goods total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatPence(total)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Creating…" : "Create purchase order"}
        </Button>
      </div>
    </div>
  );
}
