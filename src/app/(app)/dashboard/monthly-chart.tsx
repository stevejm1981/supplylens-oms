// Twelve months of expense vs profit as a server-rendered SVG, no charting
// library: paired bars per month (expense slate, profit teal, losses red
// below the axis), a zero line, and exact values in native tooltips.

import { formatPence } from "@/lib/money";

export interface MonthPoint {
  label: string;
  revenuePence: number;
  expensePence: number;
  profitPence: number;
}

const W = 980;
const H = 260;
const PAD_LEFT = 8;
const PAD_BOTTOM = 22;
const PAD_TOP = 10;

export function MonthlyChart({ points }: { points: MonthPoint[] }) {
  const maxAbs = Math.max(
    1,
    ...points.map((p) => Math.max(p.expensePence, Math.abs(p.profitPence))),
  );
  const plotH = H - PAD_BOTTOM - PAD_TOP;
  // Positive space gets the lion's share; losses get room below the axis.
  const hasLoss = points.some((p) => p.profitPence < 0);
  const negativeShare = hasLoss ? 0.25 : 0.04;
  const zeroY = PAD_TOP + plotH * (1 - negativeShare);
  const scale = (plotH * (1 - negativeShare)) / maxAbs;

  const slot = (W - PAD_LEFT) / points.length;
  const barW = Math.min(26, slot * 0.32);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[640px]"
        role="img"
        aria-label="Expense versus profit by month for the last twelve months"
      >
        {/* gridlines at quarter steps of the positive scale */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD_LEFT}
            x2={W}
            y1={zeroY - maxAbs * scale * f}
            y2={zeroY - maxAbs * scale * f}
            stroke="currentColor"
            className="text-border"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        ))}
        {/* zero line */}
        <line
          x1={PAD_LEFT}
          x2={W}
          y1={zeroY}
          y2={zeroY}
          stroke="currentColor"
          className="text-muted-foreground/60"
          strokeWidth="1.25"
        />
        {points.map((p, i) => {
          const x = PAD_LEFT + slot * i + (slot - barW * 2 - 4) / 2;
          const expenseH = p.expensePence * scale;
          const profitH = Math.abs(p.profitPence) * scale;
          const profitUp = p.profitPence >= 0;
          return (
            <g key={p.label}>
              <rect
                x={x}
                y={zeroY - expenseH}
                width={barW}
                height={Math.max(expenseH, p.expensePence > 0 ? 1.5 : 0)}
                rx="2"
                fill="#94a3b8"
              >
                <title>{`${p.label}: expenses ${formatPence(p.expensePence)} (revenue ${formatPence(p.revenuePence)})`}</title>
              </rect>
              <rect
                x={x + barW + 4}
                y={profitUp ? zeroY - profitH : zeroY}
                width={barW}
                height={Math.max(profitH, p.profitPence !== 0 ? 1.5 : 0)}
                rx="2"
                fill={profitUp ? "#0d9488" : "#dc2626"}
              >
                <title>{`${p.label}: profit ${formatPence(p.profitPence)}`}</title>
              </rect>
              <text
                x={PAD_LEFT + slot * i + slot / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize="11"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
