// Channel stock-rule pipeline. Pure functions only, no Prisma, no Next.
//
// Semantics: state starts { qty: rawQty, status: 'IS', blank: false }.
// Steps run IN ORDER and read the qty as it stands at that point, so an
// oosThreshold placed before a divide tests the raw quantity (the "Very" case:
// ≤5 → OOS, else feed qty = floor(qty / 4)), while one placed after a subtract
// tests the buffered quantity.
// Safety rails applied at the end regardless of steps: qty = max(0, floor(qty));
// blank → feed qty is null (empty cell in the feed).

export type RuleStep =
  | { type: "oosThreshold"; threshold: number }
  | { type: "subtract"; amount: number }
  | { type: "divide"; by: number; rounding: "floor" | "ceil" | "nearest" }
  | { type: "clamp"; min?: number; max?: number }
  | { type: "blankWhenOos" };

export type StockStatus = "IS" | "OOS";

export interface ChannelFeedRow {
  sku: string;
  /** Effective stock in (bundle-derived for bundles). */
  rawQty: number;
  status: StockStatus;
  /** null = blank cell in the feed. */
  feedQty: number | null;
}

export function applyRules(
  rawQty: number,
  steps: RuleStep[],
): { status: StockStatus; feedQty: number | null } {
  let qty = rawQty;
  let status: StockStatus = "IS";
  let blank = false;

  for (const step of steps) {
    switch (step.type) {
      case "oosThreshold":
        status = qty <= step.threshold ? "OOS" : "IS";
        break;
      case "subtract":
        qty -= step.amount;
        break;
      case "divide":
        if (step.by !== 0) {
          const divided = qty / step.by;
          qty =
            step.rounding === "floor"
              ? Math.floor(divided)
              : step.rounding === "ceil"
                ? Math.ceil(divided)
                : Math.round(divided);
        }
        break;
      case "clamp":
        if (step.min !== undefined) qty = Math.max(step.min, qty);
        if (step.max !== undefined) qty = Math.min(step.max, qty);
        break;
      case "blankWhenOos":
        if (status === "OOS") blank = true;
        break;
    }
  }

  qty = Math.max(0, Math.floor(qty));
  return { status, feedQty: blank ? null : qty };
}

export function buildChannelFeed(
  items: { sku: string; effectiveQty: number }[],
  steps: RuleStep[],
): ChannelFeedRow[] {
  return items.map((item) => {
    const { status, feedQty } = applyRules(item.effectiveQty, steps);
    return { sku: item.sku, rawQty: item.effectiveQty, status, feedQty };
  });
}

export function feedToCsv(rows: ChannelFeedRow[]): string {
  const lines = ["SKU,Status,Quantity"];
  for (const row of rows) {
    lines.push(`${row.sku},${row.status},${row.feedQty ?? ""}`);
  }
  return lines.join("\n") + "\n";
}

/** Parse a channel's stored rulesJson, tolerating bad data with an empty pipeline. */
export function parseRules(rulesJson: string): RuleStep[] {
  try {
    const parsed = JSON.parse(rulesJson);
    return Array.isArray(parsed) ? (parsed as RuleStep[]) : [];
  } catch {
    return [];
  }
}

export function describeStep(step: RuleStep): string {
  switch (step.type) {
    case "oosThreshold":
      return `Out of stock when qty ≤ ${step.threshold}`;
    case "subtract":
      return `Subtract ${step.amount}`;
    case "divide":
      return `Divide by ${step.by} (${step.rounding})`;
    case "clamp": {
      const parts = [];
      if (step.min !== undefined) parts.push(`min ${step.min}`);
      if (step.max !== undefined) parts.push(`max ${step.max}`);
      return `Clamp ${parts.join(", ") || "(no-op)"}`;
    }
    case "blankWhenOos":
      return "Blank quantity when out of stock";
  }
}
