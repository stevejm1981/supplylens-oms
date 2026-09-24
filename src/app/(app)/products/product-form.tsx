"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

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
import { saveProduct } from "./actions";

export interface SupplierOption {
  id: string;
  name: string;
}

export interface FamilyOption {
  id: string;
  name: string;
}

export interface ProductFormValues {
  id?: string;
  sku?: string;
  name?: string;
  barcode?: string | null;
  weightGrams?: number;
  baseCostPence?: number;
  sellPricePence?: number;
  type?: string;
  supplierId?: string | null;
  familyId?: string | null;
  variant?: string | null;
  categoryId?: string | null;
  brandId?: string | null;
  imageUrl?: string | null;
}

export function ProductFormDialog({
  product,
  suppliers,
  families = [],
  categories = [],
  brands = [],
  triggerLabel,
}: {
  product?: ProductFormValues;
  suppliers: SupplierOption[];
  families?: FamilyOption[];
  categories?: FamilyOption[];
  brands?: FamilyOption[];
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(product?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveProduct(formData);
      if (result.ok) {
        toast.success(editing ? "Product updated" : "Product created");
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
        {editing ? (
          triggerLabel ? (
            <Button variant="outline" size="sm">
              <Pencil /> {triggerLabel}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Edit product">
              <Pencil />
            </Button>
          )
        ) : (
          <Button>
            <Plus /> {triggerLabel ?? "New product"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Bundles are virtual, their stock derives from components via the BOM.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          {product?.id ? <input type="hidden" name="id" value={product.id} /> : null}
          <div className="grid grid-cols-[140px_1fr] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={product?.name} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Type</Label>
              <Select name="type" defaultValue={product?.type ?? "STANDARD"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STANDARD">Standard</SelectItem>
                  <SelectItem value="ASSEMBLED">Assembled (manufactured)</SelectItem>
                  <SelectItem value="BUNDLE">Bundle (virtual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Supplier</Label>
              <Select name="supplierId" defaultValue={product?.supplierId ?? "none"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="baseCost">Base cost (£)</Label>
              <Input
                id="baseCost"
                name="baseCost"
                inputMode="decimal"
                defaultValue={
                  product?.baseCostPence != null
                    ? (product.baseCostPence / 100).toFixed(2)
                    : ""
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sellPrice">Sell price (£)</Label>
              <Input
                id="sellPrice"
                name="sellPrice"
                inputMode="decimal"
                defaultValue={
                  product?.sellPricePence != null
                    ? (product.sellPricePence / 100).toFixed(2)
                    : ""
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="weightGrams">Weight (g)</Label>
              <Input
                id="weightGrams"
                name="weightGrams"
                type="number"
                min={0}
                defaultValue={product?.weightGrams ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Family</Label>
              <Select name="familyId" defaultValue={product?.familyId ?? "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (standalone)</SelectItem>
                  {families.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="variant">Variant</Label>
              <Input
                id="variant"
                name="variant"
                placeholder="Grey / 75 cm"
                defaultValue={product?.variant ?? ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Category</Label>
              <Select name="categoryId" defaultValue={product?.categoryId ?? "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Brand</Label>
              <Select name="brandId" defaultValue={product?.brandId ?? "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="image">Image (PNG/JPEG/WebP/SVG, ≤4 MB)</Label>
              <Input id="image" name="image" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
            </div>
            {product?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.imageUrl}
                alt=""
                className="size-10 rounded-md border object-cover"
              />
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="barcode">Barcode</Label>
            <Input id="barcode" name="barcode" defaultValue={product?.barcode ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
