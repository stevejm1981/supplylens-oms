"use client";

// Carries the tenant's custom status DISPLAY labels (from Settings) to every
// StatusBadge. The canonical codes never change, this only renames what
// humans see.

import { createContext, useContext } from "react";

const StatusLabelContext = createContext<Record<string, string>>({});

export function StatusLabelProvider({
  labels,
  children,
}: {
  labels: Record<string, string>;
  children: React.ReactNode;
}) {
  return <StatusLabelContext.Provider value={labels}>{children}</StatusLabelContext.Provider>;
}

export function useStatusLabels() {
  return useContext(StatusLabelContext);
}
