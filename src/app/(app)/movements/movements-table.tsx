"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

export interface MovementRow {
  id: string;
  when: string; // pre-formatted date
  sku: string;
  productId: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  balanceAfter: number;
  type: string;
  typeLabel: string;
  reference: string;
  href: string | null;
}

const typeStyles: Record<string, string> = {
  OPENING: "bg-muted text-muted-foreground",
  PO_RECEIPT: "bg-emerald-100 text-emerald-800",
  DESPATCH: "bg-cyan-100 text-cyan-800",
  CREDIT_RESTOCK: "bg-amber-100 text-amber-800",
  CUSTOMER_RETURN: "bg-amber-100 text-amber-800",
  SUPPLIER_RETURN: "bg-rose-100 text-rose-800",
  ADJUSTMENT: "bg-violet-100 text-violet-800",
};

export function MovementsTable({
  rows,
  warehouses,
  types,
}: {
  rows: MovementRow[];
  warehouses: { id: string; name: string }[];
  types: { value: string; label: string }[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [warehouseFilter, setWarehouseFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (warehouseFilter !== "all" && r.warehouseId !== warehouseFilter) return false;
      if (!q) return true;
      return (
        r.sku.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q)
      );
    });
  }, [rows, query, typeFilter, warehouseFilter]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search SKU, product or document ref…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All warehouses</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filtered.length} event{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      <Card>
        <CardContent className="overflow-x-auto px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Document</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="pr-6 text-right">Balance after</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-6 tabular-nums text-muted-foreground">
                    {m.when}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/products/${m.productId}`}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {m.sku}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{m.productName}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{m.warehouseName}</TableCell>
                  <TableCell>
                    <Badge className={cn("border-transparent font-medium", typeStyles[m.type])}>
                      {m.typeLabel}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.href ? (
                      <Link
                        href={m.href}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {m.reference}
                      </Link>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{m.reference}</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-medium tabular-nums",
                      m.quantity > 0 ? "text-emerald-700" : "text-rose-600",
                    )}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">{m.balanceAfter}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No stock events match.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
