"use client";

// Rate card editor. Zones are rows; breaks use the compact "units:price"
// notation carriers themselves quote in ("1:45, 3:99, 6:165" = up to 1
// pallet £45, up to 3 £99, up to 6 £165), postcode areas comma-separated.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";
import { saveRateCard } from "./actions";

export interface ZoneView {
  name: string;
  areas: string; // "BS, CF, M"
  breaks: string; // "1:45, 3:99, 6:165"
  perExtra: string; // pounds, "" = none
}

export interface CardView {
  id?: string;
  carrier: string;
  name: string;
  basis: string;
  active: boolean;
  notes: string | null;
  zones: ZoneView[];
}

function parseBreaks(text: string): { upTo: number; pricePence: number }[] | null {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const out: { upTo: number; pricePence: number }[] = [];
  for (const part of parts) {
    const m = part.match(/^(\d+)\s*[:=]\s*(\d+(?:\.\d{1,2})?)$/);
    if (!m) return null;
    out.push({ upTo: Number(m[1]), pricePence: Math.round(Number(m[2]) * 100) });
  }
  return out.length > 0 ? out : null;
}

const EMPTY_ZONE: ZoneView = { name: "", areas: "", breaks: "", perExtra: "" };

export function RateCardDialog({ card }: { card?: CardView }) {
  const editing = Boolean(card?.id);
  const [open, setOpen] = useState(false);
  const [carrier, setCarrier] = useState(card?.carrier ?? "");
  const [name, setName] = useState(card?.name ?? "");
  const [basis, setBasis] = useState(card?.basis ?? "PALLET");
  const [active, setActive] = useState(card?.active ?? true);
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [zones, setZones] = useState<ZoneView[]>(card?.zones ?? [{ ...EMPTY_ZONE }]);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const setZone = (i: number, patch: Partial<ZoneView>) =>
    setZones((prev) => prev.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));

  function submit() {
    const parsedZones: {
      name: string;
      postcodeAreas: string[];
      perExtraUnitPence: number | null;
      breaks: { upTo: number; pricePence: number }[];
    }[] = [];
    for (const zone of zones) {
      const breaks = parseBreaks(zone.breaks);
      if (!breaks) {
        toast.error(`Zone "${zone.name || "?"}": breaks look like 1:45, 3:99, 6:165`);
        return;
      }
      const perExtra = zone.perExtra.trim();
      parsedZones.push({
        name: zone.name,
        postcodeAreas: zone.areas.split(",").map((a) => a.trim()).filter(Boolean),
        perExtraUnitPence: perExtra ? Math.round(Number(perExtra) * 100) : null,
        breaks,
      });
    }
    startTransition(async () => {
      const result = await saveRateCard({
        id: card?.id,
        carrier,
        name,
        basis,
        active,
        notes: notes || null,
        zones: parsedZones,
      });
      if (result.ok) {
        toast.success(editing ? "Rate card updated" : "Rate card created");
        setOpen(false);
        router.refresh();
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon" aria-label="Edit rate card">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus /> New rate card
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit rate card" : "New rate card"}</DialogTitle>
          <DialogDescription>
            Zone pricing by delivery postcode area and consignment size. The
            matched rate pre-fills expected carriage at despatch, always
            editable, never silent.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_1fr_140px_90px] items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rc-carrier">Carrier</Label>
              <Input id="rc-carrier" placeholder="Stillers" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rc-name">Card name</Label>
              <Input id="rc-name" placeholder="Pallet rates 2026" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Priced per</Label>
              <Select value={basis} onValueChange={setBasis}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PALLET">Pallet</SelectItem>
                  <SelectItem value="CARTON">Carton</SelectItem>
                  <SelectItem value="WEIGHT">Kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rc-active">Active</Label>
              <Switch id="rc-active" checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="grid grid-cols-[130px_1fr_1fr_110px_36px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Zone</span>
              <span>Postcode areas</span>
              <span>Breaks (units:£)</span>
              <span>Extra unit (£)</span>
              <span />
            </div>
            {zones.map((zone, i) => (
              <div key={i} className="grid grid-cols-[130px_1fr_1fr_110px_36px] gap-2">
                <Input placeholder="Zone 1" value={zone.name} onChange={(e) => setZone(i, { name: e.target.value })} />
                <Input placeholder="NE, SR, DH" value={zone.areas} onChange={(e) => setZone(i, { areas: e.target.value })} />
                <Input placeholder="1:45, 3:99, 6:165" value={zone.breaks} onChange={(e) => setZone(i, { breaks: e.target.value })} />
                <Input placeholder="35.00" value={zone.perExtra} onChange={(e) => setZone(i, { perExtra: e.target.value })} />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Remove zone"
                  onClick={() => setZones((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => setZones((prev) => [...prev, { ...EMPTY_ZONE }])}
            >
              <Plus /> Add zone
            </Button>
            <p className="text-xs text-muted-foreground">
              Breaks read as &quot;up to N units costs £X&quot;: 1:45, 3:99 means 1
              pallet £45, 2 or 3 pallets £99. Extra unit prices consignments
              beyond the last break; leave it empty to cap the card there.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="rc-notes">Notes</Label>
            <Input id="rc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={submit}>
            {pending ? "Saving…" : editing ? "Save changes" : "Create rate card"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
