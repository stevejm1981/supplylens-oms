"use client";

// Searchable product picker, used everywhere a product is chosen. Type to
// filter on SKU or name; works at 15 SKUs or 5,000. Popover + command palette
// (shadcn combobox pattern) so keyboard flow is: click / Enter → type → Enter.

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface ComboProduct {
  id: string;
  sku: string;
  name: string;
  type?: string;
}

export function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = "Choose product",
}: {
  products: ComboProduct[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = products.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">
              <span className="font-mono text-xs font-medium">{selected.sku}</span>
              <span className="ml-2 text-muted-foreground">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Type a SKU or name…" />
          <CommandList>
            <CommandEmpty>No product matches.</CommandEmpty>
            <CommandGroup>
              {products.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.sku} ${p.name}`}
                  onSelect={() => {
                    onChange(p.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-1 size-4", value === p.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="font-mono text-xs font-medium">{p.sku}</span>
                  <span className="ml-1.5 truncate text-muted-foreground">
                    {p.name}
                    {p.type === "BUNDLE" ? " (bundle)" : ""}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
