import Link from "next/link";
import { LockKeyhole } from "lucide-react";

import { db } from "@/lib/db";
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
import { NewReservationDialog, ReleaseButton } from "./reservation-components";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

export default async function ReservationsPage() {
  const [reservations, products, warehouses, customers, openPos] = await Promise.all([
    db.stockReservation.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        product: { select: { sku: true, name: true } },
        warehouse: { select: { name: true } },
        customer: { select: { name: true } },
        purchaseOrder: { select: { reference: true, id: true } },
        salesOrder: { select: { reference: true, id: true } },
      },
    }),
    db.product.findMany({
      where: { type: "STANDARD" },
      orderBy: { sku: "asc" },
      select: { id: true, sku: true, name: true },
    }),
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, isDefault: true },
    }),
    db.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.purchaseOrder.findMany({
      where: { status: { not: "RECEIVED" } },
      orderBy: { reference: "asc" },
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  const now = Date.now();
  const active = reservations.filter(
    (r) => r.status === "ACTIVE" && (!r.expiresAt || r.expiresAt.getTime() > now),
  ).length;

  return (
    <div>
      <PageHeader
        title="Reservations"
        hint="Ring-fenced stock, excluded from Available and channel feeds, blocking other despatches. A reservation held for a customer is consumed automatically as their orders despatch: the pre-order mechanism."
        description={active > 0 ? `${active} active hold${active === 1 ? "" : "s"}` : undefined}
      >
        <NewReservationDialog
          products={products}
          warehouses={warehouses}
          customers={customers}
          openPos={openPos.map((po) => ({
            id: po.id,
            reference: po.reference,
            supplierName: po.supplier.name,
          }))}
        />
      </PageHeader>

      {reservations.length === 0 ? (
        <EmptyState
          icon={LockKeyhole}
          title="No reservations yet"
          description="Reserve stock to secure it for a launch or a customer's pre-order."
        >
          <NewReservationDialog
            products={products}
            warehouses={warehouses}
            customers={customers}
            openPos={openPos.map((po) => ({
              id: po.id,
              reference: po.reference,
              supplierName: po.supplier.name,
            }))}
          />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Reference</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Qty held</TableHead>
                  <TableHead>Held for</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => {
                  const expired =
                    r.status === "ACTIVE" && r.expiresAt && r.expiresAt.getTime() <= now;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">
                        {r.reference}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-medium">{r.product.sku}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.product.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.warehouse.name}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {r.quantity}
                      </TableCell>
                      <TableCell>
                        {r.customer?.name ?? "General hold"}
                        {r.salesOrder ? (
                          <Link
                            href={`/sales-orders/${r.salesOrder.id}`}
                            className="ml-1.5 font-mono text-xs text-primary hover:underline"
                          >
                            {r.salesOrder.reference}
                          </Link>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.reason ?? ", "}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {r.expiresAt ? dateFmt.format(r.expiresAt) : ", "}
                      </TableCell>
                      <TableCell>
                        {r.status === "PENDING" ? (
                          <Badge className="border-transparent bg-violet-100 text-violet-800">
                            Awaiting {r.purchaseOrder?.reference ?? "PO"}
                          </Badge>
                        ) : r.status === "RELEASED" ? (
                          <Badge className="border-transparent bg-muted text-muted-foreground">
                            Released
                          </Badge>
                        ) : expired ? (
                          <Badge className="border-transparent bg-amber-100 text-amber-800">
                            Expired
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-violet-100 text-violet-800">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end">
                          {r.status !== "RELEASED" ? <ReleaseButton id={r.id} /> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
