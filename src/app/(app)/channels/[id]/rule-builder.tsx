"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Download, Plus, Save, Trash2 } from "lucide-react";

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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import {
  buildChannelFeed,
  describeStep,
  type RuleStep,
} from "@/lib/engine/channel-rules";
import { saveChannelRules } from "../actions";

export interface FeedItem {
  sku: string;
  name: string;
  isBundle: boolean;
  effectiveQty: number;
}

function defaultStep(type: RuleStep["type"]): RuleStep {
  switch (type) {
    case "oosThreshold":
      return { type, threshold: 5 };
    case "subtract":
      return { type, amount: 20 };
    case "divide":
      return { type, by: 4, rounding: "floor" };
    case "clamp":
      return { type, min: 0 };
    case "blankWhenOos":
      return { type };
  }
}

const stepTypeLabels: Record<RuleStep["type"], string> = {
  oosThreshold: "Out-of-stock threshold",
  subtract: "Subtract buffer",
  divide: "Divide quantity",
  clamp: "Clamp min/max",
  blankWhenOos: "Blank when OOS",
};

export function RuleBuilder({
  channelId,
  channelCode,
  initialSteps,
  initialIncludeBundles,
  items,
}: {
  channelId: string;
  channelCode: string;
  initialSteps: RuleStep[];
  initialIncludeBundles: boolean;
  items: FeedItem[];
}) {
  const [steps, setSteps] = useState<RuleStep[]>(initialSteps);
  const [includeBundles, setIncludeBundles] = useState(initialIncludeBundles);
  const [newType, setNewType] = useState<RuleStep["type"]>("oosThreshold");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const feedItems = useMemo(
    () => items.filter((i) => includeBundles || !i.isBundle),
    [items, includeBundles],
  );
  const preview = useMemo(
    () => buildChannelFeed(feedItems, steps),
    [feedItems, steps],
  );
  const oosCount = preview.filter((r) => r.status === "OOS").length;

  function updateStep(index: number, patch: Partial<RuleStep>) {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? ({ ...s, ...patch } as RuleStep) : s)),
    );
  }

  function move(index: number, delta: number) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const result = await saveChannelRules(channelId, steps, includeBundles);
      if (result.ok) {
        toast.success("Channel rules saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  const numberInput = (
    value: number | undefined,
    onChange: (v: number | undefined) => void,
    placeholder?: string,
  ) => (
    <Input
      className="h-8 w-20 text-right"
      inputMode="numeric"
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) =>
        onChange(e.target.value === "" ? undefined : Number(e.target.value))
      }
    />
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="grid content-start gap-6">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Rule pipeline</CardTitle>
            <Button size="sm" onClick={save} disabled={pending}>
              <Save /> {pending ? "Saving…" : "Save rules"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-3">
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rules, the feed passes raw quantities through. Add a step below.
              </p>
            ) : null}
            {steps.map((step, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="min-w-32 text-sm font-medium">
                  {stepTypeLabels[step.type]}
                </span>
                <div className="flex items-center gap-2 text-sm">
                  {step.type === "oosThreshold"
                    ? numberInput(step.threshold, (v) =>
                        updateStep(i, { threshold: v ?? 0 }),
                      )
                    : null}
                  {step.type === "subtract"
                    ? numberInput(step.amount, (v) => updateStep(i, { amount: v ?? 0 }))
                    : null}
                  {step.type === "divide" ? (
                    <>
                      {numberInput(step.by, (v) => updateStep(i, { by: v ?? 1 }))}
                      <Select
                        value={step.rounding}
                        onValueChange={(v) =>
                          updateStep(i, { rounding: v as "floor" | "ceil" | "nearest" })
                        }
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="floor">floor</SelectItem>
                          <SelectItem value="ceil">ceil</SelectItem>
                          <SelectItem value="nearest">nearest</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  ) : null}
                  {step.type === "clamp" ? (
                    <>
                      <span className="text-xs text-muted-foreground">min</span>
                      {numberInput(step.min, (v) => updateStep(i, { min: v }), ", ")}
                      <span className="text-xs text-muted-foreground">max</span>
                      {numberInput(step.max, (v) => updateStep(i, { max: v }), ", ")}
                    </>
                  ) : null}
                </div>
                <div className="ml-auto flex items-center">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <ArrowUp />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down">
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Remove step"
                    onClick={() => setSteps((prev) => prev.filter((_, x) => x !== i))}
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="mt-1 flex items-center gap-2">
              <Select value={newType} onValueChange={(v) => setNewType(v as RuleStep["type"])}>
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(stepTypeLabels) as RuleStep["type"][]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {stepTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => setSteps((prev) => [...prev, defaultStep(newType)])}
              >
                <Plus /> Add step
              </Button>
            </div>

            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={includeBundles}
                onChange={(e) => setIncludeBundles(e.target.checked)}
              />
              Include bundles in this feed (derived availability)
            </label>

            <p className="text-xs text-muted-foreground">
              Order matters: a threshold placed <em>before</em> a divide tests the raw
              quantity (Very-style); after a subtract it tests the buffered quantity.
              Quantities are always floored and never negative.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Live preview
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {preview.length} SKUs · {oosCount} out of stock
            </span>
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a href={`/channels/${channelId}/feed`} download={`${channelCode}-stock-feed.csv`}>
              <Download /> Download feed (CSV)
            </a>
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">SKU</TableHead>
                <TableHead className="text-right">Raw qty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6 text-right">Feed qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((row) => {
                const item = feedItems.find((i) => i.sku === row.sku);
                return (
                  <TableRow key={row.sku}>
                    <TableCell className="pl-6">
                      <span className="font-mono text-xs font-medium">{row.sku}</span>
                      {item?.isBundle ? (
                        <span className="ml-2 text-xs text-muted-foreground">bundle</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.rawQty}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="pr-6 text-right font-medium tabular-nums">
                      {row.feedQty ?? <span className="text-muted-foreground">blank</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="px-6 pt-3 text-xs text-muted-foreground">
            Preview updates as you edit, the exact same engine builds the CSV. Unsaved
            changes aren&apos;t reflected in the download until you save.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
