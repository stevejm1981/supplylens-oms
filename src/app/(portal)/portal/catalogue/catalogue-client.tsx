"use client";

// Catalogue grid + basket. The basket holds product, unit, quantity only;
// prices shown are display copies, the server re-resolves them at checkout.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Search, ShoppingBasket, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { formatPence } from "@/lib/money";
import { stockBandLabels, type StockBand } from "@/lib/engine/pricing";
import { portalPlaceOrder } from "../actions";

export interface CatalogueItem {
  productId: string;
  sku: string;
  name: string;
  imageUrl: string | null;
  band: StockBand;
  listPriced: boolean;
  eachPricePence: number;
  uoms: { code: string; name: string; unitsPerUom: number; pricePence: number }[];
}

interface BasketItem {
  productId: string;
  sku: string;
  name: string;
  uomCode: string | null;
  uomLabel: string;
  unitPricePence: number; // display only
  quantity: number;
}

const bandStyles: Record<StockBand, string> = {
  IN: "border-transparent bg-emerald-100 text-emerald-800",
  LOW: "border-transparent bg-amber-100 text-amber-800",
  OUT: "border-transparent bg-rose-100 text-rose-800",
};

export function Catalogue({
  items,
  locations,
  proforma,
}: {
  items: CatalogueItem[];
  locations: { id: string; name: string; isDefault: boolean }[];
  proforma: boolean;
}) {
  const [query, setQuery] = useState("");
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [locationId, setLocationId] = useState(
    locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? "",
  );
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q),
    );
  }, [items, query]);

  function add(item: CatalogueItem, uomCode: string | null) {
    const uom = uomCode ? item.uoms.find((u) => u.code === uomCode) : null;
    setBasket((prev) => {
      const key = (b: BasketItem) => `${b.productId}|${b.uomCode ?? ""}`;
      const target = `${item.productId}|${uomCode ?? ""}`;
      const existing = prev.find((b) => key(b) === target);
      if (existing) {
        return prev.map((b) => (key(b) === target ? { ...b, quantity: b.quantity + 1 } : b));
      }
      return [
        ...prev,
        {
          productId: item.productId,
          sku: item.sku,
          name: item.name,
          uomCode,
          uomLabel: uom ? `${uom.name}` : "Each",
          unitPricePence: uom ? uom.pricePence : item.eachPricePence,
          quantity: 1,
        },
      ];
    });
    toast.success(`${item.sku} added`);
  }

  function bump(index: number, delta: number) {
    setBasket((prev) =>
      prev
        .map((b, i) => (i === index ? { ...b, quantity: Math.max(0, b.quantity + delta) } : b))
        .filter((b) => b.quantity > 0),
    );
  }

  const basketTotal = basket.reduce((s, b) => s + b.quantity * b.unitPricePence, 0);
  const basketCount = basket.reduce((s, b) => s + b.quantity, 0);

  function placeOrder() {
    startTransition(async () => {
      const result = await portalPlaceOrder({
        lines: basket.map((b) => ({
          productId: b.productId,
          uomCode: b.uomCode,
          quantity: b.quantity,
        })),
        deliveryLocationId: locationId || null,
        customerPoNumber: poNumber || null,
        notes: notes || null,
      });
      if (result.ok) {
        toast.success(
          result.proforma
            ? `Order ${result.reference} received, we will confirm once payment is arranged`
            : `Order ${result.reference} placed, thank you`,
        );
        setBasket([]);
        setCheckoutOpen(false);
        router.push(`/portal/orders/${result.orderId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search the catalogue…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="flex-1" />
        <Button
          variant={basketCount > 0 ? "default" : "outline"}
          onClick={() => setCheckoutOpen(true)}
          disabled={basketCount === 0}
        >
          <ShoppingBasket className="size-4" />
          Basket ({basketCount}) · {formatPence(basketTotal)}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((item) => (
          <Card key={item.productId}>
            <CardContent className="flex h-full flex-col gap-2 pt-5">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-28 w-full rounded-md border bg-muted/30 object-contain p-1"
                />
              ) : (
                <div className="h-28 w-full rounded-md border bg-muted/30" />
              )}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                </div>
                <Badge className={bandStyles[item.band]}>{stockBandLabels[item.band]}</Badge>
              </div>
              <div className="mt-auto flex items-center justify-between gap-2">
                <div>
                  <span className="text-lg font-semibold tabular-nums">
                    {formatPence(item.eachPricePence)}
                  </span>
                  {item.listPriced ? (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-teal-700">
                      your price
                    </span>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  disabled={item.band === "OUT"}
                  onClick={() => add(item, null)}
                >
                  <Plus className="size-3.5" /> Add
                </Button>
              </div>
              {item.uoms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {item.uoms.map((u) => (
                    <Button
                      key={u.code}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={item.band === "OUT"}
                      onClick={() => add(item, u.code)}
                    >
                      {u.name} · {formatPence(u.pricePence)}
                    </Button>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Your order</DialogTitle>
            <DialogDescription>
              {proforma
                ? "Your account pays on order, we will hold the order and confirm once payment is arranged."
                : "Ordering on account under your usual terms."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {basket.map((b, i) => (
              <div key={`${b.productId}|${b.uomCode}`} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs font-medium">{b.sku}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {b.uomLabel}
                </span>
                <Button variant="outline" size="icon" className="size-6" onClick={() => bump(i, -1)}>
                  <Minus className="size-3" />
                </Button>
                <span className="w-8 text-center tabular-nums">{b.quantity}</span>
                <Button variant="outline" size="icon" className="size-6" onClick={() => bump(i, 1)}>
                  <Plus className="size-3" />
                </Button>
                <span className="w-20 text-right tabular-nums">
                  {formatPence(b.quantity * b.unitPricePence)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-destructive"
                  onClick={() => bump(i, -b.quantity)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total (ex VAT)</span>
              <span className="tabular-nums">{formatPence(basketTotal)}</span>
            </div>
            {locations.length > 0 ? (
              <div className="grid gap-1.5">
                <Label>Deliver to</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                        {l.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="po">Your PO number</Label>
                <Input id="po" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nt">Notes</Label>
                <Input id="nt" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={placeOrder} disabled={pending || basket.length === 0}>
              {pending ? "Placing…" : "Place order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
