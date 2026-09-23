"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { saveSettings } from "./actions";

export interface PrefixField {
  key: string;
  title: string;
  value: string;
  nextNumber: number; // preview: what the next reference will look like
}
export interface StatusGroupView {
  title: string;
  note: string;
  codes: { code: string; label: string }[];
}

export function SettingsForm({
  prefixFields,
  statusGroups,
  defaultTaxTreatment,
}: {
  prefixFields: PrefixField[];
  statusGroups: StatusGroupView[];
  defaultTaxTreatment: string;
}) {
  const [prefixes, setPrefixes] = useState<Record<string, string>>(
    Object.fromEntries(prefixFields.map((f) => [f.key, f.value])),
  );
  const [labels, setLabels] = useState<Record<string, string>>(
    Object.fromEntries(statusGroups.flatMap((g) => g.codes.map((c) => [c.code, c.label]))),
  );
  const [tax, setTax] = useState(defaultTaxTreatment);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await saveSettings({
        prefixes,
        statusLabels: labels,
        defaultTaxTreatment: tax,
      });
      if (result.ok) {
        toast.success("Settings saved, new documents and labels apply immediately");
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
          <CardTitle className="text-base">
            Document numbering
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              applies to NEW documents only, existing references never change
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {prefixFields.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`px-${f.key}`}>{f.title}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`px-${f.key}`}
                  className="w-24 font-mono uppercase"
                  maxLength={6}
                  value={prefixes[f.key] ?? ""}
                  onChange={(e) =>
                    setPrefixes((p) => ({ ...p, [f.key]: e.target.value.toUpperCase() }))
                  }
                />
                <span className="font-mono text-xs text-muted-foreground">
                  next: {(prefixes[f.key] || "?").toUpperCase()}-
                  {String(f.nextNumber).padStart(4, "0")}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Status labels
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              rename what people see, the canonical codes (and the API) never change,
              so every order still walks the same path
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {statusGroups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 text-sm font-medium">{g.title}</p>
              <p className="mb-3 text-xs text-muted-foreground">{g.note}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {g.codes.map((c) => (
                  <div key={c.code} className="grid gap-1.5">
                    <Badge variant="outline" className="w-fit font-mono text-[10px]">
                      {c.code}
                    </Badge>
                    <Input
                      value={labels[c.code] ?? ""}
                      maxLength={24}
                      onChange={(e) => setLabels((p) => ({ ...p, [c.code]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Default tax treatment for new orders</Label>
            <Select value={tax} onValueChange={setTax}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXCLUSIVE">Tax exclusive (VAT added)</SelectItem>
                <SelectItem value="INCLUSIVE">Tax inclusive (VAT within)</SelectItem>
                <SelectItem value="NONE">No VAT</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pre-selects on the order form and applies to API orders that don&apos;t
              specify one.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
