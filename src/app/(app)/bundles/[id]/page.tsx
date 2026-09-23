import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { getAvailability } from "@/lib/queries";
import { bundleAvailability } from "@/lib/engine/bundle-stock";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { BomEditor } from "./bom-editor";

export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bundle, components, stock] = await Promise.all([
    db.product.findUnique({
      where: { id },
      include: { bomLines: { include: { component: true } } },
    }),
    db.product.findMany({
      where: { type: "STANDARD" },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true },
    }),
    getAvailability(),
  ]);
  if (!bundle || bundle.type !== "BUNDLE") notFound();

  // Bundles derive from component AVAILABILITY (SOH − committed − reserved),
  // not raw stock, a pre-order or reservation on a component caps the bundle.
  const availableStock = new Map(
    bundle.bomLines.map((l) => [
      l.componentId,
      Math.max(0, stock.byProduct.get(l.componentId)?.available ?? 0),
    ]),
  );
  const derivation = bundle.bomLines.map((l) => ({
    sku: l.component.sku,
    name: l.component.name,
    onHand: availableStock.get(l.componentId) ?? 0,
    perBundle: l.quantity,
    buildable:
      l.quantity > 0 ? Math.floor((availableStock.get(l.componentId) ?? 0) / l.quantity) : 0,
  }));
  const available = bundleAvailability(
    bundle.bomLines.map((l) => ({ componentId: l.componentId, quantity: l.quantity })),
    availableStock,
  );
  const constraint = Math.min(...derivation.map((d) => d.buildable));

  return (
    <div>
      <PageHeader title={bundle.sku} description={bundle.name}>
        <Badge variant="secondary" className="text-sm tabular-nums">
          {available} available
        </Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <BomEditor
          bundleId={bundle.id}
          initialLines={bundle.bomLines.map((l) => ({
            componentId: l.componentId,
            quantity: l.quantity,
          }))}
          components={components}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Availability derivation
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                min over components of floor(available ÷ per bundle), available = SOH − committed − reserved
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {derivation.length === 0 ? (
              <p className="px-6 pb-2 text-sm text-muted-foreground">
                Add components to derive availability.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Component</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Per bundle</TableHead>
                    <TableHead className="pr-6 text-right">Buildable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derivation.map((d) => {
                    const isConstraint = d.buildable === constraint;
                    return (
                      <TableRow
                        key={d.sku}
                        className={cn(isConstraint && "bg-amber-50/60")}
                      >
                        <TableCell className="pl-6">
                          <span className="font-mono text-xs font-medium">{d.sku}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{d.name}</span>
                          {isConstraint ? (
                            <Badge className="ml-2 border-transparent bg-amber-100 text-amber-800">
                              constraint
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{d.onHand}</TableCell>
                        <TableCell className="text-right tabular-nums">{d.perBundle}</TableCell>
                        <TableCell
                          className={cn(
                            "pr-6 text-right tabular-nums",
                            isConstraint && "font-semibold text-amber-800",
                          )}
                        >
                          {d.buildable}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
