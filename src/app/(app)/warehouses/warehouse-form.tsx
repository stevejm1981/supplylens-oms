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
import { Textarea } from "@/components/ui/textarea";
import { saveWarehouse } from "./actions";

export interface WarehouseFormValues {
  id?: string;
  name?: string;
  code?: string;
  isDefault?: boolean;
  notes?: string | null;
}

export function WarehouseFormDialog({ warehouse }: { warehouse?: WarehouseFormValues }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(warehouse?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveWarehouse(formData);
      if (result.ok) {
        toast.success(editing ? "Warehouse updated" : "Warehouse created");
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
          <Button variant="ghost" size="icon" aria-label="Edit warehouse">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> New warehouse
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit warehouse" : "New warehouse"}</DialogTitle>
          <DialogDescription>
            Where stock lives, a 3PL site or your own unit.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          {warehouse?.id ? <input type="hidden" name="id" value={warehouse.id} /> : null}
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Northampton DC"
                defaultValue={warehouse?.name}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" placeholder="NTH" defaultValue={warehouse?.code} required />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={warehouse?.notes ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isDefault"
              className="size-4 accent-primary"
              defaultChecked={warehouse?.isDefault}
            />
            Default warehouse (pre-selected for receiving and new sales orders)
          </label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create warehouse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
