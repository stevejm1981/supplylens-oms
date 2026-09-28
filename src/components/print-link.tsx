// A "Print" affordance that opens the document's printable route in a new
// tab (which auto-triggers the print dialog). Plain anchor, works without JS.

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintLink({ href, label }: { href: string; label?: string }) {
  return (
    <Button asChild variant="outline" size={label ? "sm" : "icon"}>
      <a href={href} target="_blank" rel="noopener" aria-label={label ?? "Print"}>
        <Printer />
        {label}
      </a>
    </Button>
  );
}
