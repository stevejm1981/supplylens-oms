"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { ProductCombobox } from "@/components/product-combobox";
import { formatPence, parsePoundsToPence } from "@/lib/money";
import { orderTotalsPence, taxTreatmentLabels } from "@/lib/sales";
import { createSalesOrder } from "../actions";

export interface CustomerLocationOption {
  id: string;
  code: string;
  name: string;
  address: string;
  contact: string | null;
  isDefault: boolean;
}

export interface CustomerOption {
  id: string;
  name: string;
  defaultSalesPersonId: string | null;
  defaultWarehouseId: string | null;
  deliveryAddress: string | null;
  locations: CustomerLocationOption[];
}
export interface SimpleOption {
  id: string;
  name: string;
  isDefault?: boolean;
}
export interface ProductUomOption {
  code: string;
  name: string;
  unitsPerUom: number;
}
export interface SellableProduct {
  id: string;
  sku: string;
  name: string;
  type: string;
  sellPricePence: number;
  uoms: ProductUomOption[];
}

interface EditableLine {
  key: number;
  productId: string;
  uomCode: string; // "each" or a ProductUom code, qty & price are per this unit
  quantity: string;
  unitPrice: string; // pounds as typed
  discount: string; // percent as typed
}

export function SoForm({
  customers,
  salespeople,
  warehouses,
  channels,
  products,
  defaultTaxTreatment = "EXCLUSIVE",
}: {
  customers: CustomerOption[];
  salespeople: SimpleOption[];
  warehouses: SimpleOption[];
  channels: SimpleOption[];
  products: SellableProduct[];
  defaultTaxTreatment?: string;
}) {
  const defaultWarehouse = warehouses.find((w) => w.isDefault)?.id ?? "";
  const [customerId, setCustomerId] = useState("");
  const [salesPersonId, setSalesPersonId] = useState("");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse);
  const [channelId, setChannelId] = useState("manual");
  const [orderDate, setOrderDate] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [customerPoNumber, setCustomerPoNumber] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [deliveryLocationId, setDeliveryLocationId] = useState("none");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryContact, setDeliveryContact] = useState("");
  const [shippingService, setShippingService] = useState("");
  const [shippingInstructions, setShippingInstructions] = useState("");
  const [giftMessage, setGiftMessage] = useState("");
  const [shippingCharge, setShippingCharge] = useState("");
  const [taxTreatment, setTaxTreatment] = useState(defaultTaxTreatment);
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([
    { key: 1, productId: "", uomCode: "each", quantity: "", unitPrice: "", discount: "" },
  ]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  function applyLocation(location: CustomerLocationOption | undefined) {
    if (!location) return;
    setDeliveryLocationId(location.id);
    // Snapshot onto the order, documents stay stable if the location changes later.
    setDeliveryAddress(location.address);
    setDeliveryContact(location.contact ?? "");
  }

  function onCustomerChange(id: string) {
    setCustomerId(id);
    const customer = customers.find((c) => c.id === id);
    // Customer defaults pre-fill but stay editable.
    if (customer?.defaultSalesPersonId) setSalesPersonId(customer.defaultSalesPersonId);
    if (customer?.defaultWarehouseId) setWarehouseId(customer.defaultWarehouseId);
    const defaultLocation =
      customer?.locations.find((l) => l.isDefault) ?? customer?.locations[0];
    if (defaultLocation) {
      applyLocation(defaultLocation);
    } else {
      setDeliveryLocationId("none");
      if (customer?.deliveryAddress) setDeliveryAddress(customer.deliveryAddress);
    }
  }

  function updateLine(key: number, patch: Partial<EditableLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.productId) {
          next.uomCode = "each"; // unit belongs to the product, reset on change
          const p = productById.get(patch.productId);
          if (!l.unitPrice && p && p.sellPricePence > 0) {
            next.unitPrice = (p.sellPricePence / 100).toFixed(2);
          }
        }
        if (patch.uomCode) {
          // Price is per ordered unit, re-derive per-pack from the each price.
          const p = productById.get(next.productId);
          const per =
            patch.uomCode === "each"
              ? 1
              : (p?.uoms.find((u) => u.code === patch.uomCode)?.unitsPerUom ?? 1);
          if (p && p.sellPricePence > 0) {
            next.unitPrice = ((p.sellPricePence * per) / 100).toFixed(2);
          }
        }
        return next;
      }),
    );
  }

  const lineUnitsPerUom = (line: EditableLine): number =>
    line.uomCode === "each"
      ? 1
      : (productById.get(line.productId)?.uoms.find((u) => u.code === line.uomCode)
          ?.unitsPerUom ?? 1);

  const shippingPence = parsePoundsToPence(shippingCharge) ?? 0;
  const totals = orderTotalsPence(
    lines.map((l) => ({
      quantity: Number(l.quantity) || 0,
      unitPricePence: parsePoundsToPence(l.unitPrice) ?? 0,
      discountPct: Number(l.discount) || 0,
    })),
    shippingPence,
    taxTreatment,
  );

  function submit() {
    startTransition(async () => {
      const result = await createSalesOrder({
        customerId,
        salesPersonId,
        warehouseId,
        channelId: channelId === "manual" ? null : channelId,
        deliveryLocationId: deliveryLocationId === "none" ? null : deliveryLocationId,
        orderDate: orderDate || null,
        requiredDate: requiredDate || null,
        customerPoNumber: customerPoNumber || null,
        externalRef: externalRef || null,
        deliveryAddress: deliveryAddress || null,
        deliveryContact: deliveryContact || null,
        shippingService: shippingService || null,
        shippingInstructions: shippingInstructions || null,
        giftMessage: giftMessage || null,
        shippingPence,
        taxTreatment,
        isPreOrder,
        notes: notes || null,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity) || 0,
          uomCode: l.uomCode === "each" ? null : l.uomCode,
          unitsPerUom: lineUnitsPerUom(l),
          unitPricePence: parsePoundsToPence(l.unitPrice) ?? 0,
          discountPct: Number(l.discount) || 0,
        })),
      });
      if (result.ok) {
        toast.success("Sales order created");
        router.push(result.id ? `/sales-orders/${result.id}` : "/sales-orders");
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
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={onCustomerChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Salesperson</Label>
            <Select value={salesPersonId} onValueChange={setSalesPersonId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose salesperson" />
              </SelectTrigger>
              <SelectContent>
                {salespeople.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                    {w.isDefault ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Channel</Label>
            <Select value={channelId} onValueChange={setChannelId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual / wholesale</SelectItem>
                {channels.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="orderDate">Order date</Label>
            <Input
              id="orderDate"
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Amounts are</Label>
            <Select value={taxTreatment} onValueChange={setTaxTreatment}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCLUSIVE">Tax exclusive (VAT added)</SelectItem>
                <SelectItem value="INCLUSIVE">Tax inclusive (VAT within)</SelectItem>
                <SelectItem value="NONE">No VAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="requiredDate">Required by</Label>
            <Input
              id="requiredDate"
              type="date"
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="customerPoNumber">Customer PO number</Label>
            <Input
              id="customerPoNumber"
              placeholder="PO-88471"
              value={customerPoNumber}
              onChange={(e) => setCustomerPoNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="externalRef">Channel order ref</Label>
            <Input
              id="externalRef"
              placeholder="MIRAKL-1029-A"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
            />
          </div>
          <div className="grid content-end gap-1.5">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={isPreOrder}
                onChange={(e) => setIsPreOrder(e.target.checked)}
              />
              <span>
                <b>Pre-order</b>, secure the stock
                <span className="block text-xs text-muted-foreground">
                  Quantities are held from the moment they land: excluded from
                  channel feeds, blocked from other despatches.
                </span>
              </span>
            </label>
          </div>
          <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delivery</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            {selectedCustomer && selectedCustomer.locations.length > 0 ? (
              <div className="grid gap-1.5">
                <Label>Delivery location</Label>
                <Select
                  value={deliveryLocationId}
                  onValueChange={(v) =>
                    applyLocation(selectedCustomer.locations.find((l) => l.id === v))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose location" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedCustomer.locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                        {l.isDefault ? " (default)" : ""},{" "}
                        <span className="font-mono text-xs">{l.code}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  The location code is what an API-synced order would carry to
                  auto-assign this address.
                </p>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <Label htmlFor="deliveryAddress">Delivery address</Label>
              <Textarea
                id="deliveryAddress"
                rows={4}
                placeholder={"Unit 4, Meadow Business Park\nNorthampton NN4 7XD"}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Pre-fills from the customer&apos;s default, edit for this order only.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="deliveryContact">Delivery contact</Label>
              <Input
                id="deliveryContact"
                placeholder="Goods In, 01604 555 010"
                value={deliveryContact}
                onChange={(e) => setDeliveryContact(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shippingService">Shipping service</Label>
              <Input
                id="shippingService"
                placeholder="DPD Next Day"
                value={shippingService}
                onChange={(e) => setShippingService(e.target.value)}
              />
            </div>
          </div>
          <div className="grid content-start gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="shippingInstructions">Shipping instructions</Label>
              <Textarea
                id="shippingInstructions"
                rows={3}
                placeholder="Book in 48h ahead. Rear dock, tail-lift required."
                value={shippingInstructions}
                onChange={(e) => setShippingInstructions(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="giftMessage">Gift message</Label>
              <Textarea
                id="giftMessage"
                rows={2}
                placeholder="Happy birthday Mum!, J x"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="shippingCharge">Shipping charge (£)</Label>
              <Input
                id="shippingCharge"
                inputMode="decimal"
                placeholder="0.00"
                value={shippingCharge}
                onChange={(e) => setShippingCharge(e.target.value)}
              />
            </div>
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
                {
                  key: Math.max(...prev.map((l) => l.key), 0) + 1,
                  productId: "",
                  uomCode: "each",
                  quantity: "",
                  unitPrice: "",
                  discount: "",
                },
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
                <TableHead className="w-36">Unit</TableHead>
                <TableHead className="w-24 text-right">Qty</TableHead>
                <TableHead className="w-32 text-right">Unit price (£)</TableHead>
                <TableHead className="w-24 text-right">Disc %</TableHead>
                <TableHead className="w-32 text-right">Line net</TableHead>
                <TableHead className="w-14 pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => {
                const pence = parsePoundsToPence(line.unitPrice) ?? 0;
                const pct = Number(line.discount) || 0;
                const lineTotal = Math.round(
                  (Number(line.quantity) || 0) * pence * (1 - pct / 100),
                );
                const lineProduct = productById.get(line.productId);
                const per = lineUnitsPerUom(line);
                const baseQty = (Number(line.quantity) || 0) * per;
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
                      <Select
                        value={line.uomCode}
                        onValueChange={(v) => updateLine(line.key, { uomCode: v })}
                        disabled={!lineProduct || lineProduct.uoms.length === 0}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="each">Each</SelectItem>
                          {lineProduct?.uoms.map((u) => (
                            <SelectItem key={u.code} value={u.code}>
                              {u.name} ({u.unitsPerUom} ea)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      />
                      {per > 1 && baseQty > 0 ? (
                        <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                          = {baseQty} ea
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="text-right"
                        inputMode="decimal"
                        placeholder="0"
                        value={line.discount}
                        onChange={(e) => updateLine(line.key, { discount: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPence(lineTotal)}</TableCell>
                    <TableCell className="pr-6 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove line"
                        disabled={lines.length === 1}
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      >
                        <Trash2 className="text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              {shippingPence > 0 ? (
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Shipping</TableCell>
                  <TableCell colSpan={4} />
                  <TableCell className="text-right tabular-nums">
                    {formatPence(shippingPence)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              ) : null}
              <TableRow>
                <TableCell className="pl-6 text-muted-foreground">
                  Net
                  <span className="ml-2 text-xs">
                    ({taxTreatmentLabels[taxTreatment]})
                  </span>
                </TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right tabular-nums">
                  {formatPence(totals.netPence)}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 text-muted-foreground">VAT</TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right tabular-nums">
                  {formatPence(totals.vatPence)}
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="pl-6 font-medium">Gross total</TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatPence(totals.grossPence)}
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
          {pending ? "Creating…" : "Create sales order"}
        </Button>
      </div>
    </div>
  );
}
