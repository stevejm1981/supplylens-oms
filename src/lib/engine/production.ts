// Production maths, pure. A completed build's finished goods enter stock at
// the ACTUAL component value consumed divided by the ACTUAL units produced,
// so yield loss and wastage land honestly in the finished item's cost
// instead of vanishing.

export interface ConsumedLine {
  componentId: string;
  actualQty: number;
  /** Component average landed cost at the moment the build started. */
  unitCostPence: number;
}

export interface BuildCost {
  totalValuePence: number; // integer pence, rounded once at the total
  unitCostPence: number; // fractional pence per finished unit
}

export interface BuildCost2 extends BuildCost {
  componentValuePence: number;
  overheadPence: number;
}

export function buildCost(
  lines: ConsumedLine[],
  producedQty: number,
  overheadPence = 0,
): BuildCost2 {
  if (producedQty <= 0) throw new Error("producedQty must be positive");
  if (overheadPence < 0) throw new Error("overhead cannot be negative");
  const componentValuePence = Math.round(
    lines.reduce((s, l) => s + l.actualQty * l.unitCostPence, 0),
  );
  const totalValuePence = componentValuePence + Math.round(overheadPence);
  return {
    componentValuePence,
    overheadPence: Math.round(overheadPence),
    totalValuePence,
    unitCostPence: totalValuePence / producedQty,
  };
}

export interface CompletionDelta {
  componentId: string;
  /** positive = consume more stock now, negative = return surplus to stock */
  delta: number;
}

/**
 * Starting a build consumes the PLANNED quantities; completion records the
 * ACTUAL quantities. The deltas are the stock corrections completion applies:
 * extra consumption for overruns, returns for surplus.
 */
export function completionDeltas(
  lines: { componentId: string; plannedQty: number; actualQty: number }[],
): CompletionDelta[] {
  return lines
    .map((l) => ({ componentId: l.componentId, delta: l.actualQty - l.plannedQty }))
    .filter((d) => d.delta !== 0);
}
