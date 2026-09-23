// Printable pick list, deliberately OUTSIDE the (app) layout group so the
// paper carries no sidebar or chrome, just the list a picker walks the
// shelves with. Opened from the Despatch Station; auto-triggers the print
// dialog. When bins and batches land, this grows a location column and a
// FEFO lot column.

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AutoPrint } from "./auto-print";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function PicklistPage({
  params,
}: {
  params: Promise<{ despatchId: string }>;
}) {
  const { despatchId } = await params;
  const despatch = await db.despatch.findUnique({
    where: { id: despatchId },
    include: {
      lines: {
        include: {
          orderLine: {
            include: {
              product: {
                include: {
                  uoms: { select: { code: true, barcode: true } },
                  bomLines: {
                    include: {
                      component: { select: { sku: true, name: true, barcode: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      salesOrder: {
        include: {
          customer: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
      },
    },
  });
  if (!despatch) notFound();
  const order = despatch.salesOrder;

  const rows = despatch.lines.map((l) => {
    const product = l.orderLine.product;
    const uom = l.orderLine.uomCode
      ? product.uoms.find((u) => u.code === l.orderLine.uomCode)
      : null;
    return {
      id: l.id,
      sku: product.sku,
      name: product.name,
      unit: l.orderLine.uomCode
        ? `${l.orderLine.uomCode} (${l.orderLine.unitsPerUom} ea)`
        : "Each",
      barcode: uom?.barcode ?? product.barcode ?? ", ",
      quantity: l.quantity,
      baseQty: l.quantity * l.orderLine.unitsPerUom,
      isBundle: product.type === "BUNDLE",
      // A bundle is virtual, the picker gathers its COMPONENTS. One sub-row
      // per component with the total to pick for this line's bundle quantity.
      components:
        product.type === "BUNDLE"
          ? product.bomLines.map((bom) => ({
              sku: bom.component.sku,
              name: bom.component.name,
              barcode: bom.component.barcode ?? ", ",
              quantity: bom.quantity * l.quantity,
            }))
          : [],
    };
  });
  const totalUnits = rows.reduce(
    (s, r) =>
      s + (r.isBundle ? r.components.reduce((x, c) => x + c.quantity, 0) : r.baseQty),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 font-sans text-sm text-slate-900 print:p-0">
      <AutoPrint />
      <header className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Pick List</h1>
          <p className="font-mono text-sm">
            {despatch.reference} · {order.reference}
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="text-base font-semibold">{order.customer.name}</p>
          <p>{order.warehouse.name}</p>
          <p>
            {order.requiredDate
              ? `Required ${dateFmt.format(order.requiredDate)}`
              : `Printed ${dateFmt.format(new Date())}`}
          </p>
          {order.shippingService ? <p>{order.shippingService}</p> : null}
        </div>
      </header>

      {order.shippingInstructions ? (
        <p className="mb-4 border-2 border-slate-900 px-3 py-2 text-xs font-semibold">
          ⚠ {order.shippingInstructions}
        </p>
      ) : null}
      {order.isPreOrder ? (
        <p className="mb-4 text-xs font-semibold">★ PRE-ORDER, stock is reserved for this order</p>
      ) : null}

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wide">
            <th className="w-8 py-2">✓</th>
            <th className="py-2">SKU</th>
            <th className="py-2">Product</th>
            <th className="py-2">Unit</th>
            <th className="py-2 text-right">Pick qty</th>
            <th className="py-2 pl-4">Barcode</th>
          </tr>
        </thead>
        <tbody>
          {rows.flatMap((r) => [
            <tr key={r.id} className="border-b border-slate-300 align-top">
              <td className="py-3">
                <span className="inline-block size-5 border-2 border-slate-900" />
              </td>
              <td className="py-3 font-mono text-xs font-semibold">{r.sku}</td>
              <td className="py-3">
                {r.name}
                {r.isBundle ? (
                  <span className="block text-xs text-slate-500">
                    virtual bundle, pick the components below, pack together
                  </span>
                ) : null}
              </td>
              <td className="py-3 text-xs">{r.unit}</td>
              <td className="py-3 text-right">
                <span className="text-lg font-bold tabular-nums">{r.quantity}</span>
                {r.baseQty !== r.quantity ? (
                  <span className="block text-xs text-slate-500">= {r.baseQty} ea</span>
                ) : null}
              </td>
              <td className="py-3 pl-4 font-mono text-xs">{r.barcode}</td>
            </tr>,
            ...r.components.map((c) => (
              <tr key={`${r.id}-${c.sku}`} className="border-b border-slate-200 bg-slate-50 align-top">
                <td className="py-2">
                  <span className="ml-4 inline-block size-4 border-2 border-slate-500" />
                </td>
                <td className="py-2 pl-4 font-mono text-xs">↳ {c.sku}</td>
                <td className="py-2 text-xs">{c.name}</td>
                <td className="py-2 text-xs">Each</td>
                <td className="py-2 text-right font-semibold tabular-nums">{c.quantity}</td>
                <td className="py-2 pl-4 font-mono text-xs">{c.barcode}</td>
              </tr>
            )),
          ])}
        </tbody>
        <tfoot>
          <tr className="text-sm font-semibold">
            <td colSpan={4} className="py-3">
              {rows.length} line{rows.length === 1 ? "" : "s"}
            </td>
            <td className="py-3 text-right tabular-nums">{totalUnits} ea total</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <footer className="mt-10 grid grid-cols-2 gap-8 text-xs">
        <div>
          <p className="mb-8">Picked by</p>
          <p className="border-t border-slate-400 pt-1">Name / signature</p>
        </div>
        <div>
          <p className="mb-8">Date / time</p>
          <p className="border-t border-slate-400 pt-1">&nbsp;</p>
        </div>
      </footer>
      <p className="mt-6 text-center text-[10px] text-slate-400 print:hidden">
        This page auto-opens the print dialog, or press ⌘P.
      </p>
    </main>
  );
}
