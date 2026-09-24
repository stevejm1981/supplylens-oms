// Typed settings over the Setting key/value table.
//
// Two families:
//   prefix.*    , document number prefixes ("SO" → SO-0001). Changing one
//                   affects NEW documents only; existing references never move.
//   statusLabel.*, DISPLAY labels for the canonical statuses. The canonical
//                   codes (DRAFT/OPEN/INVOICED, PICKING/PICKED/DESPATCHED,
//                   UNFULFILLED/PARTIAL/FULFILLED…) are the machine's fixed
//                   path, they drive every rule and are what the API always
//                   returns. Settings only rename what humans see, so a
//                   customer can call a draft a "Held order" without any
//                   integration ever noticing.

import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const DOC_PREFIX_DEFAULTS = {
  salesOrder: "SO",
  despatch: "DSP",
  invoice: "INV",
  creditNote: "CRN",
  purchaseOrder: "PO",
  customerReturn: "RMA",
  supplierReturn: "RTV",
  adjustment: "ADJ",
  transfer: "TRF",
  reservation: "RSV",
  stockJournal: "SJ",
  productionOrder: "BLD",
} as const;

export type DocType = keyof typeof DOC_PREFIX_DEFAULTS;

export const DOC_TYPE_TITLES: Record<DocType, string> = {
  salesOrder: "Sales orders",
  despatch: "Despatches",
  invoice: "Invoices",
  creditNote: "Credit notes",
  purchaseOrder: "Purchase orders",
  customerReturn: "Customer returns (RMA)",
  supplierReturn: "Supplier returns (RTV)",
  adjustment: "Stock adjustments",
  transfer: "Warehouse transfers",
  reservation: "Reservations",
  stockJournal: "Stock journals",
  productionOrder: "Production orders",
};

export const STATUS_LABEL_DEFAULTS = {
  // Order lifecycle (canonical path: DRAFT → OPEN → INVOICED)
  DRAFT: "Draft",
  OPEN: "Open",
  INVOICED: "Invoiced",
  // Fulfilment (derived from despatch documents, never stored)
  UNFULFILLED: "Unfulfilled",
  PARTIAL: "Part fulfilled",
  FULFILLED: "Fulfilled",
  // Despatch documents
  PICKING: "Picking",
  PICKED: "Picked",
  DESPATCHED: "Despatched",
  // Purchase orders
  PLACED: "Placed",
  RECEIVED: "Received",
  // Production orders
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  // Invoices (derived from paidAt/dueDate)
  UNPAID: "Unpaid",
  OVERDUE: "Overdue",
  PAID: "Paid",
} as const;

export type StatusCode = keyof typeof STATUS_LABEL_DEFAULTS;

export const STATUS_GROUPS: { title: string; note: string; codes: StatusCode[] }[] = [
  {
    title: "Sales order lifecycle",
    note: "Canonical path: DRAFT → OPEN → INVOICED. Rename freely, the codes never change.",
    codes: ["DRAFT", "OPEN", "INVOICED"],
  },
  {
    title: "Fulfilment",
    note: "Derived live from despatch documents, a status that can never drift from reality.",
    codes: ["UNFULFILLED", "PARTIAL", "FULFILLED"],
  },
  {
    title: "Despatches",
    note: "The pick-pack-ship pipeline on each despatch document.",
    codes: ["PICKING", "PICKED", "DESPATCHED"],
  },
  {
    title: "Purchase orders",
    note: "DRAFT and RECEIVED reuse the labels above where they overlap.",
    codes: ["PLACED", "RECEIVED"],
  },
  {
    title: "Production orders",
    note: "DRAFT plans the build; IN_PROGRESS has components in WIP; COMPLETED made stock.",
    codes: ["IN_PROGRESS", "COMPLETED"],
  },
  {
    title: "Invoices",
    note: "Derived from the paid date and due date, no stored status to go stale.",
    codes: ["UNPAID", "OVERDUE", "PAID"],
  },
];

export interface AppSettings {
  prefixes: Record<DocType, string>;
  statusLabels: Record<StatusCode, string>;
  defaultTaxTreatment: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const prefixes = Object.fromEntries(
    (Object.keys(DOC_PREFIX_DEFAULTS) as DocType[]).map((k) => [
      k,
      map.get(`prefix.${k}`) || DOC_PREFIX_DEFAULTS[k],
    ]),
  ) as Record<DocType, string>;
  const statusLabels = Object.fromEntries(
    (Object.keys(STATUS_LABEL_DEFAULTS) as StatusCode[]).map((k) => [
      k,
      map.get(`statusLabel.${k}`) || STATUS_LABEL_DEFAULTS[k],
    ]),
  ) as Record<StatusCode, string>;
  const tax = map.get("defaultTaxTreatment");
  return {
    prefixes,
    statusLabels,
    defaultTaxTreatment: tax === "INCLUSIVE" || tax === "NONE" ? tax : "EXCLUSIVE",
  };
}

/**
 * Next document reference: <prefix>-<sequence>. Call with the row count of
 * the document's table; the prefix comes from settings so a customer can
 * brand their numbering, while existing references never change.
 */
export async function nextRef(
  docType: DocType,
  count: number,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<string> {
  const row = await client.setting.findUnique({ where: { key: `prefix.${docType}` } });
  const prefix = row?.value || DOC_PREFIX_DEFAULTS[docType];
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
