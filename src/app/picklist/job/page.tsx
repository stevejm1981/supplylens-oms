// Consolidated job list, batch picking. One sheet totals everything to grab
// across the selected orders (one warehouse walk), with a per-order breakdown
// for sorting the pile back into orders at the bench. Read-only: despatch
// documents are still created per order at the Despatch Station, so printing
// this changes nothing.

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { AutoPrint } from "../[despatchId]/auto-print";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export default async function JobListPage({
  searchParams,
}: {
  searchParams: Promise<{ orders?: string }>;
}) {
  const { orders: idsParam } = await searchParams;
  const ids = (idsParam ?? "").split(",").filter(Boolean);
  if (ids.length === 0) notFound();

  const orders = await db.salesOrder.findMany({
    where: { id: { in: ids }, status: { in: ["DRAFT", "OPEN"] } },
    orderBy: { reference: "asc" },
    include: {
      customer: { select: { name: true } },
      lines: {
        include: {
          product: {
            include: {
              bomLines: { include: { component: { select: { sku: true, name: true, barcode: true } } } },
              uoms: { select: { code: true, barcode: true } },
            },
          },
        },
      },
      despatches: { include: { lines: true } },
    },
  });
  if (orders.length === 0) notFound();

  // Outstanding per line, mirroring the station queue (resumable docs count
  // as still-to-pick).
  interface GrabLine {
    sku: string;
    name: string;
    unit: string; // "Each" or "PACK6 (6 ea)"
    barcode: string;
    qty: number; // in the grab unit
    baseQty: number; // eaches
    from: Map<string, number>; // order reference → qty
  }
  const grab = new Map<string, GrabLine>();
  const add = (
    key: string,
    seed: Omit<GrabLine, "qty" | "baseQty" | "from">,
    orderRef: string,
    qty: number,
    baseQty: number,
  ) => {
    const entry = grab.get(key) ?? { ...seed, qty: 0, baseQty: 0, from: new Map() };
    entry.qty += qty;
    entry.baseQty += baseQty;
    entry.from.set(orderRef, (entry.from.get(orderRef) ?? 0) + qty);
    grab.set(key, entry);
  };

  const perOrder: {
    reference: string;
    customer: string;
    lines: { sku: string; name: string; unit: string; qty: number; isBundle: boolean }[];
  }[] = [];

  for (const o of orders) {
    const resumable = o.despatches.find((d) => d.status === "PICKING" || d.status === "PICKED");
    const planned = new Map<string, number>();
    for (const d of o.despatches) {
      if (d.id === resumable?.id) continue;
      for (const l of d.lines) {
        planned.set(l.orderLineId, (planned.get(l.orderLineId) ?? 0) + l.quantity);
      }
    }
    const orderLines: (typeof perOrder)[number]["lines"] = [];
    for (const l of o.lines) {
      const outstanding = l.quantity - (planned.get(l.id) ?? 0);
      if (outstanding <= 0) continue;
      const product = l.product;
      if (product.type === "BUNDLE") {
        orderLines.push({
          sku: product.sku,
          name: product.name,
          unit: "Each",
          qty: outstanding,
          isBundle: true,
        });
        // The grab list is physical, bundles are picked as their components.
        for (const bom of product.bomLines) {
          add(
            `${bom.component.sku}|each`,
            {
              sku: bom.component.sku,
              name: bom.component.name,
              unit: "Each",
              barcode: bom.component.barcode ?? ", ",
            },
            o.reference,
            bom.quantity * outstanding,
            bom.quantity * outstanding,
          );
        }
      } else {
        const unit = l.uomCode ? `${l.uomCode} (${l.unitsPerUom} ea)` : "Each";
        const outer = l.uomCode ? product.uoms.find((u) => u.code === l.uomCode) : null;
        orderLines.push({
          sku: product.sku,
          name: product.name,
          unit,
          qty: outstanding,
          isBundle: false,
        });
        add(
          `${product.sku}|${l.uomCode ?? "each"}`,
          {
            sku: product.sku,
            name: product.name,
            unit,
            barcode: outer?.barcode ?? product.barcode ?? ", ",
          },
          o.reference,
          outstanding,
          outstanding * l.unitsPerUom,
        );
      }
    }
    if (orderLines.length > 0) {
      perOrder.push({ reference: o.reference, customer: o.customer.name, lines: orderLines });
    }
  }

  const grabRows = [...grab.values()].sort((a, b) => a.sku.localeCompare(b.sku));
  const totalUnits = grabRows.reduce((s, r) => s + r.baseQty, 0);

  return (
    <main className="mx-auto max-w-3xl bg-white p-8 font-sans text-sm text-slate-900 print:p-0">
      <AutoPrint />
      <header className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold">Job List</h1>
          <p className="text-xs text-slate-500">
            Batch pick, {perOrder.length} order{perOrder.length === 1 ? "" : "s"}, one walk.
            Sort into orders at the bench, then verify each with scans at the station.
          </p>
        </div>
        <div className="text-right text-xs">
          <p className="font-mono">{perOrder.map((o) => o.reference).join(" · ")}</p>
          <p>Printed {dateFmt.format(new Date())}</p>
        </div>
      </header>

      <h2 className="mb-2 text-xs font-bold uppercase tracking-wide">Grab list (everything, consolidated)</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wide">
            <th className="w-8 py-2">✓</th>
            <th className="py-2">SKU</th>
            <th className="py-2">Product</th>
            <th className="py-2">Unit</th>
            <th className="py-2 text-right">Grab qty</th>
            <th className="py-2 pl-4">Barcode</th>
          </tr>
        </thead>
        <tbody>
          {grabRows.map((r) => (
            <tr key={`${r.sku}|${r.unit}`} className="border-b border-slate-300 align-top">
              <td className="py-2.5">
                <span className="inline-block size-5 border-2 border-slate-900" />
              </td>
              <td className="py-2.5 font-mono text-xs font-semibold">{r.sku}</td>
              <td className="py-2.5">
                {r.name}
                <span className="block text-xs text-slate-500">
                  {[...r.from.entries()].map(([ref, qty]) => `${ref} ×${qty}`).join(" · ")}
                </span>
              </td>
              <td className="py-2.5 text-xs">{r.unit}</td>
              <td className="py-2.5 text-right">
                <span className="text-lg font-bold tabular-nums">{r.qty}</span>
                {r.baseQty !== r.qty ? (
                  <span className="block text-xs text-slate-500">= {r.baseQty} ea</span>
                ) : null}
              </td>
              <td className="py-2.5 pl-4 font-mono text-xs">{r.barcode}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-sm font-semibold">
            <td colSpan={4} className="py-3">
              {grabRows.length} pick line{grabRows.length === 1 ? "" : "s"}
            </td>
            <td className="py-3 text-right tabular-nums">{totalUnits} ea total</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <h2 className="mb-2 mt-8 text-xs font-bold uppercase tracking-wide">Sort into orders</h2>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left text-xs uppercase tracking-wide">
            <th className="py-2">Order</th>
            <th className="py-2">Customer</th>
            <th className="py-2">Lines</th>
          </tr>
        </thead>
        <tbody>
          {perOrder.map((o) => (
            <tr key={o.reference} className="border-b border-slate-300 align-top">
              <td className="py-2.5 font-mono text-xs font-semibold">{o.reference}</td>
              <td className="py-2.5 text-xs">{o.customer}</td>
              <td className="py-2.5 text-xs">
                {o.lines.map((l) => (
                  <span key={`${l.sku}|${l.unit}`} className="mr-3 inline-block whitespace-nowrap">
                    <span className="font-mono font-medium">{l.sku}</span> ×{l.qty}
                    {l.unit !== "Each" ? ` ${l.unit}` : ""}
                    {l.isBundle ? " (bundle, assemble from components)" : ""}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
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
    </main>
  );
}
