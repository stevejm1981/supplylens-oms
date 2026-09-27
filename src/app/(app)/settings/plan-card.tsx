"use client";

// Plan & usage: the subscription framework. The plan is assigned here; the
// usage numbers arrive computed server-side (orders created this calendar
// month, channels in use, API calls logged) and the month's bill derives
// from the plan catalogue. Soft metering: nothing is ever blocked, overage
// bills and the card says when a bigger plan would be cheaper.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { formatPence } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setOrganisationPlan } from "./actions";

export interface PlanUsageProps {
  canManage: boolean;
  planCode: string;
  planName: string;
  monthLabel: string; // "September 2026", server-formatted
  monthlyPence: number;
  includedOrders: number;
  extraOrderPence: number;
  channelLimit: number | null;
  ordersThisMonth: number;
  extraOrders: number;
  overagePence: number;
  totalPence: number;
  betterPlanName: string | null;
  channelsInUse: number;
  channelsOver: boolean;
  apiCallsThisMonth: number;
  plans: { code: string; name: string; pricePence: number; includedOrders: number }[];
}

export function PlanUsageCard(p: PlanUsageProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pct = Math.min(100, Math.round((p.ordersThisMonth / p.includedOrders) * 100));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          Plan &amp; usage
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {p.monthLabel} · usage derives live, nothing is ever blocked
          </span>
        </CardTitle>
        <Select
          value={p.planCode}
          disabled={!p.canManage || pending}
          onValueChange={(code) =>
            startTransition(async () => {
              const result = await setOrganisationPlan(code);
              if (result.ok) {
                toast.success("Plan updated");
                router.refresh();
              } else toast.error(result.error);
            })
          }
        >
          <SelectTrigger className="h-9 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {p.plans.map((plan) => (
              <SelectItem key={plan.code} value={plan.code}>
                {plan.name} · {formatPence(plan.pricePence)}/mo · {plan.includedOrders.toLocaleString("en-GB")} orders
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">Orders this month</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {p.ordersThisMonth.toLocaleString("en-GB")}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              of {p.includedOrders.toLocaleString("en-GB")} included
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${pct}%` }}
            />
          </div>
          {p.extraOrders > 0 ? (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {p.extraOrders.toLocaleString("en-GB")} over, billed at {p.extraOrderPence}p each
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">This month&apos;s bill</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatPence(p.totalPence)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {p.planName} {formatPence(p.monthlyPence)}
            {p.overagePence > 0 ? ` + ${formatPence(p.overagePence)} overage` : ", no overage"}
          </p>
          {p.betterPlanName ? (
            <Badge className="mt-1.5 border-transparent bg-amber-100 text-amber-800">
              {p.betterPlanName} would be cheaper at this volume
            </Badge>
          ) : null}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Channels &amp; API</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {p.channelsInUse}
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              of {p.channelLimit === null ? "unlimited" : p.channelLimit} channels
            </span>
          </p>
          {p.channelsOver ? (
            <Badge className="mt-1 border-transparent bg-amber-100 text-amber-800">
              over the plan&apos;s channel allowance
            </Badge>
          ) : null}
          <p className="mt-1.5 text-xs text-muted-foreground">
            {p.apiCallsThisMonth.toLocaleString("en-GB")} API calls this month, monitored, never billed
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
