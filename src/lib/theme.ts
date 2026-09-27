// The Ordo theme: direction (a = Ledger, b = Signal) times mode (light/dark),
// carried on a cookie and stamped as data-theme on <html> by the root layout,
// so the brand bridge in globals.css re-skins everything server-side with no
// flash. Both directions ship (the brand kit holds them for choosing between);
// the switcher lets the winner be picked by using them.

import { cookies } from "next/headers";

export const ORDO_THEMES = ["a-light", "a-dark", "b-light", "b-dark"] as const;
export type OrdoTheme = (typeof ORDO_THEMES)[number];

export const THEME_COOKIE = "ordo_theme";
export const DEFAULT_THEME: OrdoTheme = "a-light";

export const THEME_LABELS: Record<OrdoTheme, string> = {
  "a-light": "Ledger light",
  "a-dark": "Ledger dark",
  "b-light": "Signal light",
  "b-dark": "Signal dark",
};

export async function getOrdoTheme(): Promise<OrdoTheme> {
  const raw = (await cookies()).get(THEME_COOKIE)?.value;
  return (ORDO_THEMES as readonly string[]).includes(raw ?? "")
    ? (raw as OrdoTheme)
    : DEFAULT_THEME;
}

export function themeDirection(theme: OrdoTheme): "ledger" | "signal" {
  return theme.startsWith("a") ? "ledger" : "signal";
}

export function themeIsDark(theme: OrdoTheme): boolean {
  return theme.endsWith("dark");
}
