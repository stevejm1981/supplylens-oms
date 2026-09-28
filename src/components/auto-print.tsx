"use client";

// Shared auto-print trigger for the printable document routes: the page
// renders, then the browser's print dialog opens on its own.

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
