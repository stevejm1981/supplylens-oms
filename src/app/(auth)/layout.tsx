// The signed-out surface (sign-in, sign-up, invitation acceptance).
// Near-black, one confident accent, a faint constellation, and a DARK card,
// so the page is a single cohesive surface. The dark form styling comes from
// overriding the theme tokens for this subtree only; the components are
// untouched.

import { Telescope } from "lucide-react";
import { AuthBackground } from "./auth-background";

// Static constellation, seeded so server and client render identical markup,
// it exists from the FIRST paint (no JS needed); the canvas animation fades
// in over it as an enhancement.
function StaticConstellation() {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const nodes = Array.from({ length: 60 }, () => ({
    x: Math.round(rand() * 1600),
    y: Math.round(rand() * 1000),
    r: (0.8 + rand() * 1.2).toFixed(1),
  }));
  const links: { a: (typeof nodes)[number]; b: (typeof nodes)[number]; o: number }[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
      if (d < 170) links.push({ a: nodes[i], b: nodes[j], o: 0.08 * (1 - d / 170) });
    }
  }
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      {links.map((l, i) => (
        <line
          key={i}
          x1={l.a.x}
          y1={l.a.y}
          x2={l.b.x}
          y2={l.b.y}
          stroke={`rgba(148,163,184,${l.o.toFixed(3)})`}
          strokeWidth="1"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill="rgba(94,234,212,0.30)" />
      ))}
    </svg>
  );
}

const darkTokens = {
  "--background": "#0a0f12",
  "--foreground": "#e7edf0",
  "--card": "#10181d",
  "--card-foreground": "#e7edf0",
  "--border": "rgba(148, 163, 184, 0.18)",
  "--input": "rgba(148, 163, 184, 0.22)",
  "--muted": "rgba(148, 163, 184, 0.10)",
  "--muted-foreground": "#8fa3ad",
  "--primary": "#14b8a6",
  "--primary-foreground": "#04211d",
  "--ring": "#2dd4bf",
} as React.CSSProperties;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ backgroundColor: "#0a0f12" }}
    >
      <StaticConstellation />
      <AuthBackground />

      <div className="relative z-10 w-full max-w-md" style={darkTokens}>
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="flex size-14 items-center justify-center rounded-2xl shadow-lg"
            style={{ background: "linear-gradient(135deg, #2dd4bf, #0891b2)", boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
          >
            <Telescope className="size-7" style={{ color: "#ffffff" }} />
          </div>
          <div className="text-center">
            <span className="text-2xl font-semibold tracking-tight" style={{ color: "#ffffff" }}>
              SupplyLens <span className="font-light" style={{ color: "#5eead4" }}>OMS</span>
            </span>
            <p className="mt-1 text-[10px] uppercase" style={{ color: "#64748b", letterSpacing: "0.28em" }}>
              Prototype · not production
            </p>
          </div>
        </div>
        <div
          className="overflow-hidden rounded-xl"
          style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.10)" }}
        >
          {/* accent hairline, the one line of colour on the card */}
          <div
            aria-hidden
            style={{ height: 2, background: "linear-gradient(90deg, #2dd4bf, #06b6d4, #2dd4bf)" }}
          />
          <div className="[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none">{children}</div>
        </div>
      </div>
    </div>
  );
}
