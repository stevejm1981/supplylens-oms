import Link from "next/link";
import { Boxes } from "lucide-react";

import { db } from "@/lib/db";
import { getAvailableEffectiveStockMap } from "@/lib/queries";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductFormDialog } from "../products/product-form";

export default async function BundlesPage() {
  const [bundles, suppliers, effective] = await Promise.all([
    db.product.findMany({
      where: { type: "BUNDLE" },
      orderBy: { sku: "asc" },
      include: { bomLines: { include: { component: true } } },
    }),
    db.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getAvailableEffectiveStockMap(),
  ]);

  return (
    <div>
      <PageHeader
        title="Bundles"
        hint="Virtual kits, no assembly step. Availability derives from component stock."
      >
        <ProductFormDialog
          suppliers={suppliers}
          product={{ type: "BUNDLE" }}
          triggerLabel="New bundle"
        />
      </PageHeader>

      {bundles.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No bundles yet"
          description="Create a bundle SKU, then add its components, stock derives automatically."
        >
          <ProductFormDialog
            suppliers={suppliers}
            product={{ type: "BUNDLE" }}
            triggerLabel="New bundle"
          />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Components</TableHead>
                  <TableHead className="pr-6 text-right">Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundles.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/bundles/${b.id}`}
                        className="font-mono text-xs font-medium text-primary hover:underline"
                      >
                        {b.sku}
                      </Link>
                    </TableCell>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {b.bomLines.map((l) => `${l.quantity}× ${l.component.sku}`).join(" · ") ||
                        "no BOM yet"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <Badge variant="secondary" className="tabular-nums">
                        {effective.get(b.id) ?? 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
