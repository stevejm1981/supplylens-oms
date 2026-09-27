// The shared signed-out scene: near-black backdrop, seeded static
// constellation (present from first paint, no JS needed), animated canvas
// fading in over it, dark theme tokens for the card, one brand hairline.
// Used by the staff sign-in (Ordo wordmark) and the trade portal sign-in
// (the merchant's name), accent colours following the Ordo direction. All
// load-bearing colours are inline styles so a dev-mode stylesheet race can
// never blank the page.

import { AuthBackground } from "@/app/(auth)/auth-background";
import { getOrdoTheme, themeDirection } from "@/lib/theme";

const DIRECTION_ACCENTS = {
  ledger: {
    dot: "rgba(95,191,154,0.30)",
    accentText: "#5fbf9a",
    hairline: "linear-gradient(90deg, #5fbf9a, #1d5a47, #5fbf9a)",
    primary: "#1d5a47",
    primarySoft: "#5fbf9a",
  },
  signal: {
    dot: "rgba(245,200,66,0.30)",
    accentText: "#f5c842",
    hairline: "linear-gradient(90deg, #f5c842, #ec7a5f, #f5c842)",
    primary: "#f2c230",
    primarySoft: "#f5c842",
  },
} as const;

function StaticConstellation({ dot }: { dot: string }) {
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
        <circle key={i} cx={n.x} cy={n.y} r={n.r} fill={dot} />
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

export async function AuthScene({
  heading,
  accent,
  sub,
  wordmark = false,
  children,
}: {
  heading?: string;
  accent?: string;
  sub: string;
  /** Render the Ordo wordmark instead of a text heading (the staff door). */
  wordmark?: boolean;
  children: React.ReactNode;
}) {
  const direction = themeDirection(await getOrdoTheme());
  const tone = DIRECTION_ACCENTS[direction];
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden p-6"
      style={{ backgroundColor: "#0a0f12" }}
    >
      <StaticConstellation dot={tone.dot} />
      <AuthBackground />

      <div
        className="relative z-10 w-full max-w-md"
        style={{ ...darkTokens, "--primary": tone.primary, "--ring": tone.primarySoft } as React.CSSProperties}
      >
        <div className="mb-8 flex flex-col items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/brand/${direction}-mark.svg`}
            alt=""
            className="size-14 rounded-2xl"
            style={{ boxShadow: "0 10px 25px rgba(0,0,0,0.5)" }}
          />
          <div className="text-center">
            {wordmark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/brand/${direction}-wordmark-reversed.svg`}
                alt="Ordo"
                className="mx-auto h-8 w-auto"
              />
            ) : (
              <span className="text-2xl font-semibold tracking-tight" style={{ color: "#ffffff" }}>
                {heading}
                {accent ? (
                  <>
                    {" "}
                    <span className="font-light" style={{ color: tone.accentText }}>
                      {accent}
                    </span>
                  </>
                ) : null}
              </span>
            )}
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
            style={{ height: 2, background: tone.hairline }}
          />
          <div className="[&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&_.max-w-md]:max-w-none">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
