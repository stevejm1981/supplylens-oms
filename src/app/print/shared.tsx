// The shared letterhead and layout for every printable document. These
// routes live OUTSIDE the (app) group on purpose: the paper carries no
// sidebar or chrome, just the document. Each page fetches its own data and
// renders through PrintShell so all documents share one visual language.

import type { ReactNode } from "react";

import { db } from "@/lib/db";
import { asAddress, formatAddress } from "@/lib/address";
import { AutoPrint } from "@/components/auto-print";

export const printDateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export interface PrintOrg {
  name: string;
  vatNumber: string | null;
  addressBlock: string; // formatted, may be ""
}

export async function getPrintOrg(): Promise<PrintOrg> {
  const org = await db.organisation.findFirst();
  return {
    name: org?.name ?? "",
    vatNumber: org?.vatNumber ?? null,
    addressBlock: formatAddress(asAddress(org?.address)),
  };
}

export interface MetaItem {
  label: string;
  value: string | null;
}

export interface Party {
  label: string; // "Bill to", "Deliver to", "Supplier"
  body: string; // pre-formatted block, rendered whitespace-pre-line
}

export function PrintShell({
  org,
  docTitle,
  reference,
  meta,
  parties,
  children,
  notes,
  footNote,
}: {
  org: PrintOrg;
  docTitle: string;
  reference: string;
  meta: MetaItem[];
  parties: Party[];
  children: ReactNode;
  notes?: string | null;
  footNote?: string | null;
}) {
  return (
    <main className="mx-auto max-w-3xl bg-white p-8 font-sans text-sm text-slate-900 print:p-0">
      <AutoPrint />
      <header className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold">{docTitle}</h1>
          <p className="font-mono text-base">{reference}</p>
        </div>
        <div className="text-right text-xs">
          <p className="text-base font-semibold">{org.name}</p>
          {org.addressBlock ? <p className="whitespace-pre-line">{org.addressBlock}</p> : null}
          {org.vatNumber ? <p className="mt-1">VAT {org.vatNumber}</p> : null}
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-6">
        <div className="grid content-start gap-3">
          {parties.map((p) => (
            <div key={p.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {p.label}
              </p>
              <p className="whitespace-pre-line">{p.body || ", "}</p>
            </div>
          ))}
        </div>
        <div className="grid content-start grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {meta
            .filter((m) => m.value)
            .map((m) => (
              <div key={m.label} className="contents">
                <span className="font-semibold text-slate-500">{m.label}</span>
                <span>{m.value}</span>
              </div>
            ))}
        </div>
      </div>

      {children}

      {notes ? (
        <div className="mt-6 border-t border-slate-300 pt-3 text-xs">
          <p className="font-semibold uppercase tracking-wide text-slate-500">Notes</p>
          <p className="whitespace-pre-line">{notes}</p>
        </div>
      ) : null}
      {footNote ? <p className="mt-6 text-xs text-slate-500">{footNote}</p> : null}
    </main>
  );
}

// ── Table primitives, one look for every document ───────────────────────────

export function DocTable({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>;
}

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) {
  return (
    <th
      className={`border-b-2 border-slate-900 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ${
        right ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  mono,
}: {
  children?: ReactNode;
  right?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className={`border-b border-slate-200 py-1.5 align-top ${right ? "text-right tabular-nums" : ""} ${
        mono ? "font-mono text-xs" : ""
      }`}
    >
      {children}
    </td>
  );
}

/** Right-aligned totals block under a table. */
export function TotalsBlock({ rows }: { rows: { label: string; value: string; strong?: boolean }[] }) {
  return (
    <div className="mt-3 ml-auto w-64 text-sm">
      {rows.map((r) => (
        <div
          key={r.label}
          className={`flex justify-between py-1 ${
            r.strong ? "border-t-2 border-slate-900 text-base font-bold" : "border-t border-slate-200"
          }`}
        >
          <span>{r.label}</span>
          <span className="tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
