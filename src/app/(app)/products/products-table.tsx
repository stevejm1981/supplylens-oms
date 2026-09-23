"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

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
import { formatPence } from "@/lib/money";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ProductFormDialog, type FamilyOption, type SupplierOption } from "./product-form";
import { deleteProduct } from "./actions";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  type: string;
  variant: string | null;
  familyId: string | null;
  familyName: string | null;
  supplierName: string | null;
  supplierId: string | null;
  barcode: string | null;
  weightGrams: number;
  baseCostPence: number;
  sellPricePence: number;
  avgLandedPence: number | null;
  onHand: number;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  imageUrl: string | null;
}

export function ProductsTable({
  rows,
  suppliers,
  families,
  categories,
  brands,
}: {
  rows: ProductRow[];
  suppliers: SupplierOption[];
  families: FamilyOption[];
  categories: FamilyOption[];
  brands: FamilyOption[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (categoryFilter !== "all" && r.categoryId !== categoryFilter) return false;
      if (brandFilter !== "all" && r.brandId !== brandFilter) return false;
      if (!q) return true;
      return (
        r.sku.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.familyName ?? "").toLowerCase().includes(q) ||
        (r.variant ?? "").toLowerCase().includes(q) ||
        (r.brandName ?? "").toLowerCase().includes(q) ||
        (r.categoryName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, categoryFilter, brandFilter]);

  // Group: families (in name order) first, then standalone products.
  const groups = useMemo(() => {
    const byFamily = new Map<string, { name: string; rows: ProductRow[] }>();
    const standalone: ProductRow[] = [];
    for (const row of filtered) {
      if (row.familyId && row.familyName) {
        const g = byFamily.get(row.familyId) ?? { name: row.familyName, rows: [] };
        g.rows.push(row);
        byFamily.set(row.familyId, g);
      } else {
        standalone.push(row);
      }
    }
    return {
      families: [...byFamily.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name)),
      standalone,
    };
  }, [filtered]);

  const renderRow = (p: ProductRow, inFamily: boolean) => {
    const uplift =
      p.type === "STANDARD" && p.avgLandedPence != null && p.baseCostPence > 0
        ? p.avgLandedPence / p.baseCostPence - 1
        : null;
    return (
      <TableRow key={p.id}>
        <TableCell className={inFamily ? "pl-12" : "pl-6"}>
          <div className="flex items-center gap-2.5">
            {inFamily ? (
              <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
            ) : null}
            {p.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.imageUrl}
                alt=""
                className="size-8 shrink-0 rounded-md border object-cover"
              />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] font-semibold text-muted-foreground">
                {p.sku.slice(0, 2)}
              </div>
            )}
            <Link
              href={`/products/${p.id}`}
              className="font-mono text-xs font-medium text-primary hover:underline"
            >
              {p.sku}
            </Link>
            {p.variant ? (
              <Badge variant="outline" className="font-normal">
                {p.variant}
              </Badge>
            ) : null}
          </div>
        </TableCell>
        <TableCell>
          <div className="font-medium">{p.name}</div>
          {p.brandName || p.categoryName ? (
            <div className="text-xs text-muted-foreground">
              {[p.brandName, p.categoryName].filter(Boolean).join(" · ")}
            </div>
          ) : null}
        </TableCell>
        <TableCell>
          {p.type === "BUNDLE" ? (
            <Badge variant="secondary">Bundle</Badge>
          ) : (
            <Badge variant="outline">Standard</Badge>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground">{p.supplierName ?? ", "}</TableCell>
        <TableCell className="text-right tabular-nums">
          {p.type === "BUNDLE" ? ", " : formatPence(p.baseCostPence)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {p.type === "BUNDLE" ? (
            ", "
          ) : p.avgLandedPence != null ? (
            <span>
              {formatPence(p.avgLandedPence, 2)}
              {uplift != null && uplift > 0.001 ? (
                <span className="ml-1 text-xs text-amber-600">
                  +{(uplift * 100).toFixed(1)}%
                </span>
              ) : null}
            </span>
          ) : (
            ", "
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {p.type === "BUNDLE" ? ", " : p.onHand}
        </TableCell>
        <TableCell className="pr-6">
          <div className="flex justify-end gap-1">
            <ProductFormDialog
              product={p}
              suppliers={suppliers}
              families={families}
              categories={categories}
              brands={brands}
            />
            <ConfirmDelete id={p.id} label="product" action={deleteProduct} />
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search SKU, name, family, variant, brand…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Base cost</TableHead>
                <TableHead className="text-right">Avg landed</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="w-24 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.families.map(([familyId, group]) => {
                const totalOnHand = group.rows.reduce((s, r) => s + r.onHand, 0);
                return [
                  <TableRow key={familyId} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell className="pl-6" colSpan={6}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.name}
                      </span>
                      <Badge variant="secondary" className="ml-2">
                        {group.rows.length} variant{group.rows.length === 1 ? "" : "s"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums text-muted-foreground">
                      {totalOnHand}
                    </TableCell>
                    <TableCell className="pr-6" />
                  </TableRow>,
                  ...group.rows.map((p) => renderRow(p, true)),
                ];
              })}
              {groups.standalone.map((p) => renderRow(p, false))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nothing matches “{query}”.
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
