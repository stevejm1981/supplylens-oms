// Month-bucketing for the dashboard's twelve-month series. Pure date maths:
// build the window of months ending at "now", then sum dated amounts into it.
// Anything outside the window is ignored, never mis-bucketed.

export interface MonthBucket {
  key: string; // "2026-09"
  label: string; // "Sep 26"
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** The last n calendar months INCLUDING the current one, oldest first. */
export function lastMonths(n: number, now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
    });
  }
  return buckets;
}

/** Sum dated pence amounts into the bucket window, aligned to its order. */
export function sumByMonth(
  buckets: MonthBucket[],
  items: { date: Date; amountPence: number }[],
): number[] {
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  const totals = new Array<number>(buckets.length).fill(0);
  for (const item of items) {
    const i = index.get(monthKey(item.date));
    if (i != null) totals[i] += item.amountPence;
  }
  return totals;
}
