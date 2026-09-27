"use client";

// Appearance: pick the Ordo brand direction and mode. The brand kit ships
// two directions to choose between (A Ledger, B Signal); switching here (or
// with the sidebar toggles) restyles every screen instantly and remembers
// per browser via a cookie.

import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const THEMES = [
  { value: "a-light", name: "Ledger light", blurb: "Forest green on warm paper, square corners. Calm and exact." },
  { value: "a-dark", name: "Ledger dark", blurb: "The same precision on a deep green-black ground." },
  { value: "b-light", name: "Signal light", blurb: "Signal yellow, black, and clay on cream. Fast and confident." },
  { value: "b-dark", name: "Signal dark", blurb: "Yellow and clay glowing on near-black." },
] as const;

export function AppearanceCard({ theme }: { theme: string }) {
  const router = useRouter();
  function apply(value: string) {
    document.cookie = `ordo_theme=${value}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.setAttribute("data-theme", value);
    router.refresh();
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Appearance
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            two brand directions, light and dark each; per browser, everyone picks their own
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => apply(t.value)}
            className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 ${
              theme === t.value ? "border-primary bg-accent/60" : ""
            }`}
          >
            <span
              aria-hidden
              className="mt-0.5 inline-block size-5 shrink-0 rounded-md border"
              style={{
                background: t.value.startsWith("a") ? "#1d5a47" : "#f2c230",
                borderColor: t.value.endsWith("dark") ? "#141414" : "var(--line-strong)",
                boxShadow: t.value.endsWith("dark") ? "inset 0 0 0 2px #141414" : undefined,
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {t.name}
                {theme === t.value ? <Check className="size-3.5 text-primary" /> : null}
              </span>
              <span className="block text-xs text-muted-foreground">{t.blurb}</span>
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
