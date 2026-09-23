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
import { saveSupplier } from "./actions";

export interface SupplierFormValues {
  id?: string;
  name?: string;
  code?: string;
  country?: string;
  contactEmail?: string | null;
  leadTimeDays?: number | null;
  notes?: string | null;
}

export function SupplierFormDialog({ supplier }: { supplier?: SupplierFormValues }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(supplier?.id);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await saveSupplier(formData);
      if (result.ok) {
        toast.success(editing ? "Supplier updated" : "Supplier created");
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
          <Button variant="ghost" size="icon" aria-label="Edit supplier">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> New supplier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>
            Suppliers you raise purchase orders against.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          {supplier?.id ? <input type="hidden" name="id" value={supplier.id} /> : null}
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={supplier?.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="code">Code</Label>
              <Input id="code" name="code" defaultValue={supplier?.code} placeholder="SBT" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" name="country" defaultValue={supplier?.country} placeholder="CN" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="leadTimeDays">Lead time (days)</Label>
              <Input
                id="leadTimeDays"
                name="leadTimeDays"
                type="number"
                min={0}
                defaultValue={supplier?.leadTimeDays ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="contactEmail">Contact email</Label>
            <Input
              id="contactEmail"
              name="contactEmail"
              type="email"
              defaultValue={supplier?.contactEmail ?? ""}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={supplier?.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
