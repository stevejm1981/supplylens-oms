"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Layers, Shapes, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveBrand, saveCategory, saveFamily } from "./actions";

type Kind = "family" | "category" | "brand";

const config: Record<
  Kind,
  { title: string; description: string; namePlaceholder: string; codePlaceholder: string }
> = {
  family: {
    title: "New product family",
    description: "Groups variants of one product, colours, sizes, pack counts.",
    namePlaceholder: "Chunky Knit Blanket",
    codePlaceholder: "HMW-BLANKET",
  },
  category: {
    title: "New category",
    description: "Merchandising taxonomy, where the product sits in your range.",
    namePlaceholder: "Garden & Outdoor",
    codePlaceholder: "GARDEN",
  },
  brand: {
    title: "New brand",
    description: "Whose label is on the product.",
    namePlaceholder: "Ember & Oak",
    codePlaceholder: "EMBOAK",
  },
};

const actions: Record<Kind, (fd: FormData) => Promise<{ ok: true } | { ok: false; error: string }>> = {
  family: saveFamily,
  category: saveCategory,
  brand: saveBrand,
};

export function NewGroupMenu() {
  const [kind, setKind] = useState<Kind | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!kind) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await actions[kind](formData);
      if (result.ok) {
        toast.success(`${config[kind].title.replace("New ", "")} created`);
        setKind(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <Layers /> New group <ChevronDown className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setKind("family")}>
            <Layers /> Family (variants)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKind("category")}>
            <Shapes /> Category
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setKind("brand")}>
            <Tag /> Brand
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={kind !== null} onOpenChange={(open) => !open && setKind(null)}>
        <DialogContent className="sm:max-w-sm">
          {kind ? (
            <>
              <DialogHeader>
                <DialogTitle>{config[kind].title}</DialogTitle>
                <DialogDescription>{config[kind].description}</DialogDescription>
              </DialogHeader>
              <form onSubmit={onSubmit} className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" placeholder={config[kind].namePlaceholder} required />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="code">Code</Label>
                  <Input id="code" name="code" placeholder={config[kind].codePlaceholder} required />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    {pending ? "Creating…" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
