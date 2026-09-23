"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { deleteLocation, saveLocation, setDefaultLocation } from "./actions";

export interface LocationView {
  id: string;
  code: string;
  name: string;
  address: string;
  contact: string | null;
  isDefault: boolean;
}

export function LocationsDialog({
  customerId,
  customerName,
  locations,
}: {
  customerId: string;
  customerName: string;
  locations: LocationView[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean } & { error?: string }>, success: string) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  }

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await saveLocation(formData);
      if (result.ok) {
        toast.success("Location added");
        form.reset();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delivery locations">
          <MapPin />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delivery locations, {customerName}</DialogTitle>
          <DialogDescription>
            Named delivery points. The <b>code</b> is the API key: a synced order
            carrying that value auto-assigns the location.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {locations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No locations yet, add the first below.</p>
          ) : (
            locations.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{l.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{l.code}</span>
                    {l.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-muted-foreground">
                    {l.address}
                    {l.contact ? `\n${l.contact}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  {!l.isDefault ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Set as default"
                      disabled={pending}
                      onClick={() => run(() => setDefaultLocation(l.id), "Default location updated")}
                    >
                      <Star className="text-muted-foreground" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete location"
                    disabled={pending}
                    onClick={() => run(() => deleteLocation(l.id), "Location deleted")}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={onAdd} className="grid gap-3 border-t pt-4">
          <input type="hidden" name="customerId" value={customerId} />
          <div className="grid grid-cols-[1fr_150px] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="loc-name">Name</Label>
              <Input id="loc-name" name="name" placeholder="Avonmouth DC 3" required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="loc-code">Code (API key)</Label>
              <Input id="loc-code" name="code" placeholder="AVONMOUTH-DC3" required />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loc-address">Address</Label>
            <Textarea id="loc-address" name="address" rows={2} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="loc-contact">Contact</Label>
            <Input id="loc-contact" name="contact" placeholder="Goods In, 0117 555 0123" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add location"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
