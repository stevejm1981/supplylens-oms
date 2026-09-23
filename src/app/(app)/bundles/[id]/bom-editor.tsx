"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProductCombobox } from "@/components/product-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { saveBom } from "../actions";

export interface ComponentOption {
  id: string;
  sku: string;
  name: string;
}

interface EditableBomLine {
  key: number;
  componentId: string;
  quantity: string;
}

export function BomEditor({
  bundleId,
  initialLines,
  components,
}: {
  bundleId: string;
  initialLines: { componentId: string; quantity: number }[];
  components: ComponentOption[];
}) {
  const [lines, setLines] = useState<EditableBomLine[]>(
    initialLines.length > 0
      ? initialLines.map((l, i) => ({
          key: i + 1,
          componentId: l.componentId,
          quantity: String(l.quantity),
        }))
      : [{ key: 1, componentId: "", quantity: "1" }],
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const result = await saveBom(
        bundleId,
        lines.map((l) => ({
          componentId: l.componentId,
          quantity: Number(l.quantity) || 0,
        })),
      );
      if (result.ok) {
        toast.success("BOM saved");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Bill of materials</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setLines((prev) => [
                ...prev,
                {
                  key: Math.max(...prev.map((l) => l.key), 0) + 1,
                  componentId: "",
                  quantity: "1",
                },
              ])
            }
          >
            <Plus /> Add component
          </Button>
          <Button size="sm" onClick={submit} disabled={pending}>
            <Save /> {pending ? "Saving…" : "Save BOM"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Component</TableHead>
              <TableHead className="w-32 text-right">Qty per bundle</TableHead>
              <TableHead className="w-14 pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.key}>
                <TableCell className="pl-6">
                  <ProductCombobox
                    products={components}
                    value={line.componentId}
                    onChange={(v) =>
                      setLines((prev) =>
                        prev.map((l) => (l.key === line.key ? { ...l, componentId: v } : l)),
                      )
                    }
                    placeholder="Choose component"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="text-right"
                    inputMode="numeric"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l) =>
                          l.key === line.key ? { ...l, quantity: e.target.value } : l,
                        ),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove component"
                    onClick={() =>
                      setLines((prev) => prev.filter((l) => l.key !== line.key))
                    }
                  >
                    <Trash2 className="text-muted-foreground" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-6 pt-3 text-xs text-muted-foreground">
          Components must be standard products, bundles inside bundles aren&apos;t supported
          (standard virtual-bundle behaviour).
        </p>
      </CardContent>
    </Card>
  );
}
