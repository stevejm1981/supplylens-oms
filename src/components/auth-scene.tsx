// The shared signed-out scene: near-black backdrop, seeded static
// constellation (present from first paint, no JS needed), animated canvas
// fading in over it, dark theme tokens for the card, one teal hairline.
// Used by the staff sign-in and the trade portal sign-in, with different
// branding text. All load-bearing colours are inline styles so a dev-mode
// stylesheet race can never blank the page.

import { Telescope } from "lucide-react";
import { AuthBackground } from "@/app/(auth)/auth-background";

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

export function AuthScene({
  heading,
  accent,
  sub,
  children,
}: {
  heading: string;
  accent?: string;
  sub: string;
  children: React.ReactNode;
}) {
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
            style={{
              background: "linear-gradient(135deg, #2dd4bf, #0891b2)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            }}
          >
            <Telescope className="size-7" style={{ color: "#ffffff" }} />
          </div>
          <div className="text-center">
            <span className="text-2xl font-semibold tracking-tight" style={{ color: "#ffffff" }}>
              {heading}
              {accent ? (
                <>
                  {" "}
                  <span className="font-light" style={{ color: "#5eead4" }}>
                    {accent}
                  </span>
                </>
              ) : null}
            </span>
            <p className="mt-1 text-[10px] uppercase" style={{ color: "#64748b", letterSpacing: "0.28em" }}>
              {sub}
            </p>
          </div>
        </div>
        <div
          className="overflow-hidden rounded-xl"
          style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.10)" }}
        >
          <div
            aria-hidden
            style={{ height: 2, background: "linear-gradient(90deg, #2dd4bf, #06b6d4, #2dd4bf)" }}
          />
          <div className="[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&_.max-w-md]:max-w-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
