"use client";

// The Ordo theme switch: mode (light/dark) and direction (Ledger/Signal).
// Sets the cookie, stamps data-theme on <html> for an instant repaint, and
// refreshes so server-rendered logo assets follow.

import { useRouter } from "next/navigation";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

export type OrdoThemeValue = "a-light" | "a-dark" | "b-light" | "b-dark";

function apply(theme: OrdoThemeValue, router: ReturnType<typeof useRouter>) {
  document.cookie = `ordo_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.setAttribute("data-theme", theme);
  router.refresh();
}

export function ThemeSwitcher({ theme }: { theme: OrdoThemeValue }) {
  const router = useRouter();
  const dark = theme.endsWith("dark");
  const direction = theme.startsWith("a") ? "a" : "b";
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => apply(`${direction}-${dark ? "light" : "dark"}` as OrdoThemeValue, router)}
      >
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 font-heading text-xs font-bold"
        aria-label={direction === "a" ? "Switch to the Signal direction" : "Switch to the Ledger direction"}
        title={direction === "a" ? "Direction: Ledger. Click for Signal." : "Direction: Signal. Click for Ledger."}
        onClick={() =>
          apply(`${direction === "a" ? "b" : "a"}-${dark ? "dark" : "light"}` as OrdoThemeValue, router)
        }
      >
        {direction === "a" ? "A" : "B"}
      </Button>
    </div>
  );
}
