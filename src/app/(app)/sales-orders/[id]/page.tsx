import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { formatPence } from "@/lib/money";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SoActions } from "./so-actions";
import { CreditDialog } from "./credit-dialog";
import { CreateDespatchDialog, DespatchRowActions } from "./despatch-components";
import { BookReturnDialog } from "./return-dialog";
import { AmendDialog } from "./amend-dialog";
import { CoverShortfallButton } from "./cover-shortfall";
import { getOrderBackorder } from "@/lib/backorder";
import { Badge } from "@/components/ui/badge";
import {
  effectiveUnitPricePence,
  fillRates,
  formatFill,
  lineNetPence,
  linesNetPence,
  orderTotalsPence,
  taxTreatmentLabels,
} from "@/lib/sales";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function SalesOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [order, warehouses] = await Promise.all([
    db.salesOrder.findUnique({
      where: { id },
      include: {
        customer: true,
        salesPerson: true,
        warehouse: true,
        channel: true,
        deliveryLocation: { select: { name: true, code: true } },
        lines: { include: { product: true, despatchLines: true, returnLines: true } },
        invoice: true,
        despatches: { include: { lines: true }, orderBy: { reference: "asc" } },
        creditNotes: { include: { lines: true }, orderBy: { creditDate: "asc" } },
        amendments: { orderBy: { createdAt: "asc" } },
      },
    }),
    db.warehouse.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  if (!order) notFound();

  const creditedByProduct = new Map<string, number>();
  for (const note of order.creditNotes) {
    for (const l of note.lines) {
      creditedByProduct.set(l.productId, (creditedByProduct.get(l.productId) ?? 0) + l.quantity);
    }
  }
  const creditedNet = order.creditNotes.reduce((s, n) => s + n.netPence, 0);

  const dispatched = order.dispatchedAt != null;
  const linesNet = linesNetPence(order.lines);
  const totals = orderTotalsPence(order.lines, order.shippingPence, order.taxTreatment);
  const net = totals.netPence;
  const vat = totals.vatPence;
  const cogs = dispatched
    ? order.lines.reduce((s, l) => s + l.quantity * (l.unitCogsPence ?? 0), 0)
    : null;
  const margin = cogs != null ? net - cogs : null;

  // Fulfilment: derived from despatch documents.
  const despatchedByLine = new Map<string, number>();
  const plannedByLine = new Map<string, number>();
  for (const d of order.despatches) {
    for (const l of d.lines) {
      plannedByLine.set(l.orderLineId, (plannedByLine.get(l.orderLineId) ?? 0) + l.quantity);
      despatchedByLine.set(
        l.orderLineId,
        (despatchedByLine.get(l.orderLineId) ?? 0) + l.despatchedQty,
      );
    }
  }
  const totalOrdered = order.lines.reduce((s, l) => s + l.quantity, 0);
  const totalDespatched = order.lines.reduce(
    (s, l) => s + (despatchedByLine.get(l.id) ?? 0),
    0,
  );
  const fulfilment =
    totalDespatched === 0 ? "UNFULFILLED" : totalDespatched >= totalOrdered ? "FULFILLED" : "PARTIAL";
  const fullyDespatched = fulfilment === "FULFILLED";
  const skuByOrderLine = new Map(order.lines.map((l) => [l.id, l.product.sku]));
  const amended = order.lines.some((l) => l.originalQty !== l.quantity);
  const backorder = await getOrderBackorder(order.id);
  const isBackordered = backorder.shortfalls.length > 0;
  const fill = fillRates(
    order.lines.map((l) => ({
      originalQty: l.originalQty,
      quantity: l.quantity,
      despatchedQty: despatchedByLine.get(l.id) ?? 0,
      unitsPerUom: l.unitsPerUom,
    })),
  );

  return (
    <div>
      <PageHeader
        title={order.reference}
        description={`${order.customer.name} · ${order.channel?.name ?? "Manual"} · ${order.salesPerson.name} · ${order.warehouse.name} · ${dateFmt.format(order.orderDate)}`}
      >
        <StatusBadge status={order.status} />
        {order.isPreOrder ? (
          <Badge className="border-transparent bg-violet-100 text-violet-800">Pre-order</Badge>
        ) : null}
        {isBackordered ? (
          <Badge className="border-transparent bg-amber-100 text-amber-800">Back order</Badge>
        ) : null}
        {order.status !== "DRAFT" ? <StatusBadge status={fulfilment} /> : null}
        <SoActions id={order.id} status={order.status} fullyDespatched={fullyDespatched} />
        {order.status === "DRAFT" ? (
          <AmendDialog
            orderId={order.id}
            lines={order.lines.map((l) => ({
              orderLineId: l.id,
              sku: l.product.sku,
              originalQty: l.originalQty,
              quantity: l.quantity,
            }))}
          />
        ) : null}
        {order.status !== "INVOICED" ? (
          <CreateDespatchDialog
            orderId={order.id}
            lines={order.lines.map((l) => ({
              orderLineId: l.id,
              sku: l.product.sku,
              name: l.product.name,
              outstanding: l.quantity - (plannedByLine.get(l.id) ?? 0),
            }))}
          />
        ) : null}
        <BookReturnDialog
          salesOrderId={order.id}
          lines={order.lines.map((l) => ({
            orderLineId: l.id,
            sku: l.product.sku,
            returnable:
              l.despatchLines.reduce((s, d) => s + d.despatchedQty, 0) -
              l.returnLines.reduce((s, r) => s + r.quantity, 0),
          }))}
          warehouses={warehouses}
          defaultWarehouseId={order.warehouseId}
        />
        {order.status === "INVOICED" ? (
          <CreditDialog
            salesOrderId={order.id}
            lines={order.lines.map((l) => ({
              orderLineId: l.id,
              sku: l.product.sku,
              name: l.product.name,
              ordered: l.quantity,
              alreadyCredited: creditedByProduct.get(l.productId) ?? 0,
              // Default credits to the discounted price the customer actually paid.
              unitPricePence: Math.round(effectiveUnitPricePence(l)),
            }))}
            warehouses={warehouses}
            defaultWarehouseId={order.warehouseId}
            taxTreatment={order.taxTreatment}
          />
        ) : null}
      </PageHeader>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery &amp; references</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Deliver to
              </p>
              {order.deliveryLocation ? (
                <p className="mt-1 text-sm font-medium">
                  {order.deliveryLocation.name}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {order.deliveryLocation.code}
                  </span>
                </p>
              ) : null}
              <p className="mt-1 whitespace-pre-line">
                {order.deliveryAddress ?? ", "}
              </p>
              {order.deliveryContact ? (
                <p className="mt-1 text-muted-foreground">{order.deliveryContact}</p>
              ) : null}
            </div>
            <div className="grid content-start gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Shipping
                </p>
                <p className="mt-1">
                  {order.shippingService ?? ", "}
                  <span className="ml-2 text-xs text-muted-foreground">
                    tracking lives on each despatch below
                  </span>
                </p>
              </div>
              {order.shippingInstructions ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Instructions
                  </p>
                  <p className="mt-1 whitespace-pre-line">{order.shippingInstructions}</p>
                </div>
              ) : null}
              {order.giftMessage ? (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Gift message
                  </p>
                  <p className="mt-1 italic">“{order.giftMessage}”</p>
                </div>
              ) : null}
            </div>
            <div className="grid content-start gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Customer PO
                </p>
                <p className="mt-1 font-mono text-xs">{order.customerPoNumber ?? ", "}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Channel order ref
                </p>
                <p className="mt-1 font-mono text-xs">{order.externalRef ?? ", "}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Required by
                </p>
                <p className="mt-1">
                  {order.requiredDate ? dateFmt.format(order.requiredDate) : ", "}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Lines
              {!dispatched ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  margin appears after dispatch, when COGS is snapshotted at landed cost
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">SKU</TableHead>
                  <TableHead className="text-right">Original</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Disc</TableHead>
                  <TableHead className="text-right">Line net</TableHead>
                  {dispatched ? (
                    <>
                      <TableHead className="text-right">Unit COGS (landed)</TableHead>
                      <TableHead className="text-right">Line margin</TableHead>
                      <TableHead className="pr-6 text-right">Margin %</TableHead>
                    </>
                  ) : (
                    <TableHead className="pr-6" />
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.lines.map((line) => {
                  const lineNet = lineNetPence(line);
                  const lineCogs =
                    line.unitCogsPence != null ? line.quantity * line.unitCogsPence : null;
                  const lineMargin = lineCogs != null ? lineNet - lineCogs : null;
                  return (
                    <TableRow key={line.id}>
                      <TableCell className="pl-6">
                        <div className="font-mono text-xs font-medium">
                          <Link
                            href={`/products/${line.productId}`}
                            className="text-primary hover:underline"
                          >
                            {line.product.sku}
                          </Link>
                          {line.product.type === "BUNDLE" ? (
                            <span className="ml-2 font-sans text-xs text-muted-foreground">
                              bundle
                            </span>
                          ) : null}
                          {line.uomCode ? (
                            <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 font-sans text-xs text-secondary-foreground">
                              {line.uomCode} · {line.unitsPerUom} ea
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">{line.product.name}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {line.originalQty}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums ${
                          line.quantity !== line.originalQty ? "font-semibold text-amber-700" : ""
                        }`}
                      >
                        {line.quantity}
                        {line.unitsPerUom > 1 ? (
                          <span className="block text-xs font-normal text-muted-foreground">
                            = {line.quantity * line.unitsPerUom} ea
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPence(line.unitPricePence)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {line.discountPct > 0 ? `${line.discountPct}%` : ", "}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatPence(lineNet)}</TableCell>
                      {dispatched ? (
                        <>
                          <TableCell className="text-right tabular-nums">
                            {line.unitCogsPence != null
                              ? formatPence(line.unitCogsPence, 4)
                              : ", "}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {lineMargin != null ? formatPence(lineMargin) : ", "}
                          </TableCell>
                          <TableCell
                            className={`pr-6 text-right tabular-nums ${
                              lineMargin != null && lineMargin < 0
                                ? "text-rose-600"
                                : "text-emerald-700"
                            }`}
                          >
                            {lineMargin != null && lineNet > 0
                              ? `${((lineMargin / lineNet) * 100).toFixed(1)}%`
                              : ", "}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell className="pr-6" />
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">
                    Totals
                    {order.shippingPence > 0 ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        incl. {formatPence(order.shippingPence)} shipping
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {order.lines.reduce((s, l) => s + l.originalQty, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {order.lines.reduce((s, l) => s + l.quantity, 0)}
                  </TableCell>
                  <TableCell colSpan={2} />
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatPence(net)}
                  </TableCell>
                  {dispatched ? (
                    <>
                      <TableCell className="text-right tabular-nums">
                        {cogs != null ? formatPence(cogs) : ", "}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {margin != null ? formatPence(margin) : ", "}
                      </TableCell>
                      <TableCell className="pr-6 text-right font-semibold tabular-nums">
                        {margin != null && net > 0 ? `${((margin / net) * 100).toFixed(1)}%` : ", "}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="pr-6" />
                  )}
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Despatches
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                the order is the agreement, each despatch is one physical shipment
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {order.despatches.length === 0 ? (
              <p className="px-6 pb-2 text-sm text-muted-foreground">
                No despatches yet, click <b>Create despatch</b> to start picking.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Lines (ordered → picked → despatched)</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead className="pr-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.despatches.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">
                        {d.reference}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {d.lines
                          .map(
                            (l) =>
                              `${skuByOrderLine.get(l.orderLineId) ?? "?"} ${l.quantity} → ${l.pickedQty} → ${l.despatchedQty}`,
                          )
                          .join(" · ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {d.shippingService ?? ", "}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {d.trackingNumber ?? ", "}
                      </TableCell>
                      <TableCell className="pr-6">
                        <div className="flex justify-end">
                          <DespatchRowActions
                            despatch={{
                              id: d.id,
                              status: d.status,
                              shippingService: d.shippingService,
                              lines: d.lines.map((l) => ({
                                id: l.id,
                                sku: skuByOrderLine.get(l.orderLineId) ?? "?",
                                quantity: l.quantity,
                                pickedQty: l.pickedQty,
                              })),
                            }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Totals
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {taxTreatmentLabels[order.taxTreatment] ?? order.taxTreatment}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {order.shippingPence > 0 ? (
                  <>
                    <dt className="text-muted-foreground">Goods</dt>
                    <dd className="text-right tabular-nums">{formatPence(linesNet)}</dd>
                    <dt className="text-muted-foreground">Shipping</dt>
                    <dd className="text-right tabular-nums">
                      {formatPence(order.shippingPence)}
                    </dd>
                  </>
                ) : null}
                <dt className="text-muted-foreground">Net</dt>
                <dd className="text-right tabular-nums">{formatPence(net)}</dd>
                <dt className="text-muted-foreground">VAT</dt>
                <dd className="text-right tabular-nums">{formatPence(vat)}</dd>
                <dt className="font-medium">Gross</dt>
                <dd className="text-right font-semibold tabular-nums">{formatPence(net + vat)}</dd>
                {amended || dispatched ? (
                  <>
                    <dt className="mt-2 text-muted-foreground">Confirmation fill</dt>
                    <dd className="mt-2 text-right tabular-nums">{formatFill(fill.confirmation)}</dd>
                    <dt className="text-muted-foreground">Dispatch vs original</dt>
                    <dd className="text-right tabular-nums">{formatFill(fill.dispatchOriginal)}</dd>
                    <dt className="text-muted-foreground">Dispatch vs confirmed</dt>
                    <dd className="text-right tabular-nums">{formatFill(fill.dispatchConfirmed)}</dd>
                  </>
                ) : null}
                {margin != null ? (
                  <>
                    <dt className="mt-2 text-muted-foreground">COGS @ landed</dt>
                    <dd className="mt-2 text-right tabular-nums">{formatPence(cogs!)}</dd>
                    <dt className="font-medium text-emerald-700">Margin</dt>
                    <dd className="text-right font-semibold tabular-nums text-emerald-700">
                      {formatPence(margin)}{" "}
                      {net > 0 ? `(${((margin / net) * 100).toFixed(1)}%)` : ""}
                    </dd>
                  </>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {order.invoice ? (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Number</dt>
                  <dd className="text-right font-mono text-xs font-semibold">
                    {order.invoice.number}
                  </dd>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-right tabular-nums">
                    {dateFmt.format(order.invoice.invoiceDate)}
                  </dd>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd className="text-right tabular-nums">
                    {order.invoice.dueDate ? dateFmt.format(order.invoice.dueDate) : ", "}
                  </dd>
                  <dt className="text-muted-foreground">Net / VAT / Gross</dt>
                  <dd className="text-right tabular-nums">
                    {formatPence(order.invoice.netPence)} / {formatPence(order.invoice.vatPence)} /{" "}
                    <b>{formatPence(order.invoice.grossPence)}</b>
                  </dd>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {order.status === "DRAFT"
                    ? "Create a despatch first, invoicing unlocks once every line has shipped."
                    : fullyDespatched
                      ? "Fully despatched, click Create invoice to raise it."
                      : "Invoicing unlocks once every line is despatched (partial invoicing is a future step)."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {isBackordered || backorder.coverage.length > 0 ? (
        <Card className="mb-6 border-amber-200">
          <CardHeader>
            <CardTitle className="text-base">
              Back order
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                demand this order can&apos;t currently be supplied from stock, cover it and the
                incoming goods are secured for this order automatically
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {backorder.shortfalls.length > 0 ? (
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 text-sm">
                  {backorder.shortfalls.map((sf) => (
                    <span key={sf.productId} className="mr-4 inline-block whitespace-nowrap">
                      <span className="font-mono text-xs font-medium">{sf.sku}</span>{" "}
                      <span className="font-semibold text-amber-700">{sf.shortfall} short</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({sf.supplierName ?? "no supplier"})
                      </span>
                    </span>
                  ))}
                </div>
                <CoverShortfallButton orderId={order.id} />
              </div>
            ) : null}
            {backorder.coverage.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Covered by
                </p>
                <ul className="grid gap-1.5 text-sm">
                  {backorder.coverage.map((c) => (
                    <li key={c.reservationId} className="flex flex-wrap items-center gap-2">
                      {c.poId ? (
                        <Link
                          href={`/purchase-orders/${c.poId}`}
                          className="font-mono text-xs font-medium text-primary hover:underline"
                        >
                          {c.poReference}
                        </Link>
                      ) : (
                        <span className="font-mono text-xs">{c.reference}</span>
                      )}
                      <span className="font-mono text-xs">{c.sku}</span>
                      <span className="tabular-nums">×{c.quantity}</span>
                      <StatusBadge status={c.status === "PENDING" ? "AWAITING" : c.status} />
                      {c.poExpectedDate ? (
                        <span className="text-xs text-muted-foreground">
                          ETA {dateFmt.format(c.poExpectedDate)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">no ETA set on the PO yet</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {order.amendments.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Amendment history
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  original quantities are never lost
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">When</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="pr-6">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.amendments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="pl-6 tabular-nums text-muted-foreground">
                        {dateFmt.format(a.createdAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium">{a.sku}</TableCell>
                      <TableCell className="tabular-nums">
                        {a.field === "line-added"
                          ? `added × ${a.newValue}`
                          : a.field === "line-cancelled"
                            ? `${a.oldValue} → cancelled`
                            : `${a.oldValue} → ${a.newValue}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.reason}</TableCell>
                      <TableCell className="pr-6">
                        <Badge variant="outline">{a.source}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}

        {order.creditNotes.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Credit notes
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {formatPence(creditedNet)} net credited, order nets to{" "}
                  {formatPence(net - creditedNet)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Lines</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="pr-6 text-right">Gross</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.creditNotes.map((note) => (
                    <TableRow key={note.id}>
                      <TableCell className="pl-6 font-mono text-xs font-semibold">
                        {note.number}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {dateFmt.format(note.creditDate)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {note.reason ?? ", "}
                      </TableCell>
                      <TableCell>
                        {note.restock ? (
                          <Badge className="border-transparent bg-emerald-100 text-emerald-800">
                            Restocked
                          </Badge>
                        ) : (
                          <Badge className="border-transparent bg-amber-100 text-amber-800">
                            Write-off
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {note.lines
                          .map((l) => {
                            const product = order.lines.find(
                              (ol) => ol.productId === l.productId,
                            )?.product;
                            return `${l.quantity}× ${product?.sku ?? l.productId}`;
                          })
                          .join(" · ")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        −{formatPence(note.netPence)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
                        −{formatPence(note.grossPence)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
