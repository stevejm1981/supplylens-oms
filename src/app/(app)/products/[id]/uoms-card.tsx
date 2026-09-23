"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boxes, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteProductUom, saveProductUom } from "../actions";

export interface UomView {
  id: string;
  code: string;
  name: string;
  unitsPerUom: number;
  barcode: string | null;
}

export function UomsCard({ productId, uoms }: { productId: string; uoms: UomView[] }) {
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await saveProductUom({
        productId,
        code: (data.get("code") as string) ?? "",
        name: (data.get("name") as string) ?? "",
        unitsPerUom: Number(data.get("unitsPerUom") ?? 0),
        barcode: ((data.get("barcode") as string) ?? "").trim() || null,
      });
      if (result.ok) {
        toast.success("Pack configuration saved");
        form.reset();
        setAdding(false);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await deleteProductUom(id);
      if (result.ok) {
        toast.success("Pack configuration removed");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Pack configurations</CardTitle>
        <Button variant="outline" size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="mr-1.5 size-3.5" />
          Add pack
        </Button>
      </CardHeader>
      <CardContent>
        {uoms.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">
            Sold in eaches only. Add a pack or case unit, with its own outer
            barcode, and retailers can order it directly (16 × pack of 6 = 96
            eaches from stock).
          </p>
        ) : (
          <ul className="space-y-2">
            {uoms.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm"
              >
                <Boxes className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-xs font-medium">{u.code}</span>
                  <span className="ml-2">{u.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    = {u.unitsPerUom} ea
                  </span>
                  {u.barcode ? (
                    <div className="truncate font-mono text-xs text-muted-foreground">
                      outer barcode {u.barcode}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => onDelete(u.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {adding ? (
          <form onSubmit={onAdd} className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="uom-code">Code</Label>
                <Input id="uom-code" name="code" placeholder="PACK6" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uom-units">Units per pack</Label>
                <Input
                  id="uom-units"
                  name="unitsPerUom"
                  type="number"
                  min={2}
                  placeholder="6"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uom-name">Name</Label>
              <Input id="uom-name" name="name" placeholder="Pack of 6" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="uom-barcode">Outer barcode (GTIN, optional)</Label>
              <Input id="uom-barcode" name="barcode" placeholder="5060871330288" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={pending}>
                Save pack
              </Button>
            </div>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
