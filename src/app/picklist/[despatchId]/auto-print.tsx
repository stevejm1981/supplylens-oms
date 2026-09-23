"use client";

import { useEffect } from "react";

export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
