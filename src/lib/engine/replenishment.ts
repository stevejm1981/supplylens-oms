// Replenishment maths, pure, no Prisma/Next imports.
//
// Classic min/max reorder logic on trailing sales velocity:
//   velocity      = base units despatched in the window ÷ window days
//   reorder point = velocity × (supplier lead time + safety stock days)
//   order-up-to   = velocity × (lead time + safety + order cycle)
// A SKU wants ordering when its stock position (available + on order) falls
// to the reorder point; the suggestion tops it back up to the order-up-to
// level. Everything is in base units (eaches), pack lines were already
// converted when they hit the despatch ledger.

/** Trailing window the sales velocity is measured over. */
export const VELOCITY_WINDOW_DAYS = 28;
/** Buffer beyond the lead time, absorbs demand spikes and late containers. */
export const SAFETY_STOCK_DAYS = 14;
/** How much cover an order should buy beyond the reorder point. */
export const ORDER_CYCLE_DAYS = 30;
/** Used when the supplier has no lead time recorded. */
export const DEFAULT_LEAD_TIME_DAYS = 30;

export type ReplenishmentStatus = "OUT" | "REORDER" | "WATCH" | "OK" | "NO_SALES";

export interface ReplenishmentInput {
  /** Base units despatched over the window (positive number). */
  despatchedInWindow: number;
  windowDays: number;
  /** Sellable now: onHand − committed − reserved, floored at 0 upstream or not, pass raw. */
  available: number;
  /** Inbound on placed POs. */
  onOrder: number;
  leadTimeDays: number | null;
}

export interface ReplenishmentResult {
  velocityPerDay: number;
  leadTimeDays: number; // resolved (default applied)
  /** available ÷ velocity; null when there are no sales to burn it. */
  daysOfCover: number | null;
  /** (available + onOrder) ÷ velocity. */
  daysOfCoverInbound: number | null;
  reorderPointUnits: number;
  orderUpToUnits: number;
  status: ReplenishmentStatus;
  /** Units to order now to reach the order-up-to level (0 when none needed). */
  suggestedOrderQty: number;
}

export function assessReplenishment(input: ReplenishmentInput): ReplenishmentResult {
  const windowDays = Math.max(1, input.windowDays);
  const velocityPerDay = Math.max(0, input.despatchedInWindow) / windowDays;
  const leadTimeDays = input.leadTimeDays ?? DEFAULT_LEAD_TIME_DAYS;
  const position = input.available + input.onOrder;

  const reorderPointUnits = Math.ceil(velocityPerDay * (leadTimeDays + SAFETY_STOCK_DAYS));
  const orderUpToUnits = Math.ceil(
    velocityPerDay * (leadTimeDays + SAFETY_STOCK_DAYS + ORDER_CYCLE_DAYS),
  );

  if (velocityPerDay === 0) {
    return {
      velocityPerDay,
      leadTimeDays,
      daysOfCover: null,
      daysOfCoverInbound: null,
      reorderPointUnits,
      orderUpToUnits,
      status: "NO_SALES",
      suggestedOrderQty: 0,
    };
  }

  const daysOfCover = Math.max(0, input.available) / velocityPerDay;
  const daysOfCoverInbound = Math.max(0, position) / velocityPerDay;
  const suggestedOrderQty = Math.max(0, orderUpToUnits - position);

  let status: ReplenishmentStatus;
  if (input.available <= 0) {
    status = "OUT";
  } else if (position <= reorderPointUnits) {
    status = "REORDER";
  } else if (position <= reorderPointUnits + velocityPerDay * 7) {
    // Within a week of tripping the reorder point.
    status = "WATCH";
  } else {
    status = "OK";
  }

  return {
    velocityPerDay,
    leadTimeDays,
    daysOfCover,
    daysOfCoverInbound,
    reorderPointUnits,
    orderUpToUnits,
    status,
    suggestedOrderQty: status === "OK" ? 0 : suggestedOrderQty,
  };
}

export const replenishmentStatusLabels: Record<ReplenishmentStatus, string> = {
  OUT: "Out of stock",
  REORDER: "Reorder now",
  WATCH: "Watch",
  OK: "OK",
  NO_SALES: "No recent sales",
};
