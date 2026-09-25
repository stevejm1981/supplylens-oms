import { Users } from "lucide-react";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { orderNetPence } from "@/lib/sales";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerFormDialog } from "./customer-form";
import { LocationsDialog } from "./locations-dialog";
import { PortalAccessDialog, PriceListDialog } from "./portal-dialogs";
import { deleteCustomer } from "./actions";

export default async function CustomersPage() {
  const [customers, salespeople, warehouses, products] = await Promise.all([
    db.customer.findMany({
      orderBy: { name: "asc" },
      include: {
        defaultSalesPerson: true,
        defaultWarehouse: true,
        locations: { orderBy: [{ isDefault: "desc" }, { name: "asc" }] },
        prices: { include: { product: { select: { sku: true, name: true, sellPricePence: true } } }, orderBy: { product: { sku: "asc" } } },
        portalUsers: { orderBy: { name: "asc" } },
        portalInvitations: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } },
        salesOrders: {
          where: { OR: [{ status: "INVOICED" }, { dispatchedAt: { not: null } }] },
          include: { lines: true },
        },
        _count: { select: { salesOrders: true } },
      },
    }),
    db.salesPerson.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.warehouse.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({ orderBy: { sku: "asc" }, select: { id: true, sku: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Customers"
        hint="Who you sell to. Default salesperson and warehouse set here pre-fill every new sales order."
      >
        <CustomerFormDialog salespeople={salespeople} warehouses={warehouses} />
      </PageHeader>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Add a customer with a default salesperson, new orders pick it up automatically."
        >
          <CustomerFormDialog salespeople={salespeople} warehouses={warehouses} />
        </EmptyState>
      ) : (
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Default salesperson</TableHead>
                  <TableHead>Default warehouse</TableHead>
                  <TableHead className="text-right">Locations</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="w-24 pr-6" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => {
                  const revenue = c.salesOrders.reduce(
                    (s, o) => s + orderNetPence(o.lines, o.shippingPence, o.taxTreatment),
                    0,
                  );
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="pl-6 font-medium">{c.name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.code}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.defaultSalesPerson?.name ?? ", "}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.defaultWarehouse?.name ?? ", "}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.locations.length}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c._count.salesOrders}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPence(revenue)}</TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end gap-1">
                          <LocationsDialog
                            customerId={c.id}
                            customerName={c.name}
                            locations={c.locations}
                          />
                          <PriceListDialog
                            customerId={c.id}
                            customerName={c.name}
                            products={products}
                            prices={c.prices.map((pr) => ({
                              id: pr.id,
                              sku: pr.product.sku,
                              name: pr.product.name,
                              unitPricePence: pr.unitPricePence,
                              sellPricePence: pr.product.sellPricePence,
                            }))}
                          />
                          <PortalAccessDialog
                            customerId={c.id}
                            customerName={c.name}
                            users={c.portalUsers.map((u) => ({ id: u.id, name: u.name, email: u.email }))}
                            invites={c.portalInvitations.map((inv) => ({
                              id: inv.id,
                              email: inv.email,
                              link: `/portal/invite/${inv.token}`,
                              expired: inv.expiresAt.getTime() < Date.now(),
                            }))}
                          />
                          <CustomerFormDialog
                            customer={c}
                            salespeople={salespeople}
                            warehouses={warehouses}
                          />
                          <ConfirmDelete id={c.id} label="customer" action={deleteCustomer} />
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
