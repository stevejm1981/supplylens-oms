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
import { Textarea } from "@/components/ui/textarea";
import { saveCustomer } from "./actions";

export interface Option {
  id: string;
  name: string;
}

export interface CustomerFormValues {
  id?: string;
  name?: string;
  code?: string;
  email?: string | null;
  phone?: string | null;
  deliveryAddress?: string | null;
  paymentTermsDays?: number;
  notes?: string | null;
  defaultSalesPersonId?: string | null;
  defaultWarehouseId?: string | null;
}

export function CustomerFormDialog({
  customer,
  salespeople,
  warehouses,
}: {
  customer?: CustomerFormValues;
  salespeople: Option[];
  warehouses: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(customer?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveCustomer(formData);
      if (result.ok) {
        toast.success(editing ? "Customer updated" : "Customer created");
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
          <Button variant="ghost" size="icon" aria-label="Edit customer">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> New customer
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Defaults set here pre-fill new sales orders, salesperson and warehouse.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          {customer?.id ? <input type="hidden" name="id" value={customer.id} /> : null}
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={customer?.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="RANGE" defaultValue={customer?.code} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Default salesperson</Label>
              <Select
                name="defaultSalesPersonId"
                defaultValue={customer?.defaultSalesPersonId ?? "none"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {salespeople.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Default warehouse</Label>
              <Select
                name="defaultWarehouseId"
                defaultValue={customer?.defaultWarehouseId ?? "none"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_120px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={customer?.phone ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="paymentTermsDays">Terms (days)</Label>
              <Input
                id="paymentTermsDays"
                name="paymentTermsDays"
                type="number"
                min={0}
                defaultValue={customer?.paymentTermsDays ?? 30}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="deliveryAddress">Default delivery address</Label>
            <Textarea
              id="deliveryAddress"
              name="deliveryAddress"
              rows={3}
              placeholder={"Unit 4, Meadow Business Park\nNorthampton NN4 7XD"}
              defaultValue={customer?.deliveryAddress ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={customer?.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
