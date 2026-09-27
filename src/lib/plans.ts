// The subscription plan catalogue and the usage maths. Plans are code-level
// configuration (they change by deploy, not by database edit); an
// organisation carries only its plan CODE, and usage is always derived live
// (orders created this calendar month, channels in use, API calls logged),
// never a stored counter that can drift.
//
// Pricing principle: bill on orders and channels, the numbers a customer
// already thinks in. API calls are MONITORED (support, fair use) but never
// priced; charging per call would punish deep integration, which is the
// product's whole point.

export interface Plan {
  code: string;
  name: string;
  monthlyPence: number;
  includedOrders: number;
  extraOrderPence: number;
  /** null = unlimited */
  channelLimit: number | null;
}

export const PLANS: Plan[] = [
  { code: "STARTER", name: "Starter", monthlyPence: 24900, includedOrders: 1000, extraOrderPence: 20, channelLimit: 3 },
  { code: "GROWTH", name: "Growth", monthlyPence: 44900, includedOrders: 3000, extraOrderPence: 15, channelLimit: 6 },
  { code: "SCALE", name: "Scale", monthlyPence: 74900, includedOrders: 8000, extraOrderPence: 10, channelLimit: 12 },
  { code: "PRO", name: "Pro", monthlyPence: 119900, includedOrders: 20000, extraOrderPence: 6, channelLimit: null },
  { code: "ENTERPRISE", name: "Enterprise", monthlyPence: 199900, includedOrders: 50000, extraOrderPence: 4, channelLimit: null },
];

export function getPlan(code: string): Plan {
  return PLANS.find((p) => p.code === code) ?? PLANS[0];
}

export interface UsageCharge {
  plan: Plan;
  orders: number;
  includedUsed: number;
  extraOrders: number;
  overagePence: number;
  totalPence: number; // base + overage
  /** The cheaper plan for this volume, when one exists. */
  betterPlan: Plan | null;
}

/** The month's bill for a plan at a given order volume, plus upgrade advice. */
export function usageCharge(planCode: string, orders: number): UsageCharge {
  const plan = getPlan(planCode);
  const included = Math.max(0, Math.min(orders, plan.includedOrders));
  const extra = Math.max(0, orders - plan.includedOrders);
  const overagePence = extra * plan.extraOrderPence;
  const totalPence = plan.monthlyPence + overagePence;
  let betterPlan: Plan | null = null;
  for (const candidate of PLANS) {
    if (candidate.code === plan.code) continue;
    const candidateTotal =
      candidate.monthlyPence +
      Math.max(0, orders - candidate.includedOrders) * candidate.extraOrderPence;
    if (candidateTotal < totalPence && (!betterPlan
      ? true
      : candidateTotal <
        betterPlan.monthlyPence +
          Math.max(0, orders - betterPlan.includedOrders) * betterPlan.extraOrderPence)) {
      betterPlan = candidate;
    }
  }
  return { plan, orders, includedUsed: included, extraOrders: extra, overagePence, totalPence, betterPlan };
}

/** Channel headroom under the plan; over = true means the cap is exceeded. */
export function channelHeadroom(planCode: string, channelsInUse: number): {
  limit: number | null;
  over: boolean;
} {
  const plan = getPlan(planCode);
  return {
    limit: plan.channelLimit,
    over: plan.channelLimit != null && channelsInUse > plan.channelLimit,
  };
}
