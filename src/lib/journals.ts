// Stock journal writer, call INSIDE the same transaction as the stock event,
// so the accounting shadow can never exist without its physical cause (or
// vice versa). Debits must equal credits; totalPence is that value.

import type { Prisma } from "@/generated/prisma/client";
import { nextRef } from "@/lib/settings";

export type StockJournalType =
  | "DESPATCH_COGS"
  | "PO_RECEIPT"
  | "RETURN_RESTOCK"
  | "CREDIT_RESTOCK"
  | "ADJUSTMENT"
  | "PRODUCTION";

export interface JournalLineInput {
  account: string;
  debitPence?: number;
  creditPence?: number;
  description?: string;
}

export async function recordStockJournal(
  tx: Prisma.TransactionClient,
  event: {
    type: StockJournalType;
    sourceRef: string;
    sourceId?: string | null;
    memo: string;
    lines: JournalLineInput[];
  },
): Promise<void> {
  const debits = event.lines.reduce((s, l) => s + (l.debitPence ?? 0), 0);
  const credits = event.lines.reduce((s, l) => s + (l.creditPence ?? 0), 0);
  if (debits !== credits) {
    throw new Error(`Stock journal for ${event.sourceRef} does not balance: ${debits} vs ${credits}`);
  }
  if (debits === 0) return; // nothing of value moved, no journal
  const count = await tx.stockJournal.count();
  await tx.stockJournal.create({
    data: {
      reference: await nextRef("stockJournal", count, tx),
      type: event.type,
      sourceRef: event.sourceRef,
      sourceId: event.sourceId ?? null,
      memo: event.memo,
      totalPence: debits,
      lines: {
        create: event.lines
          .filter((l) => (l.debitPence ?? 0) > 0 || (l.creditPence ?? 0) > 0)
          .map((l) => ({
            account: l.account,
            debitPence: l.debitPence ?? 0,
            creditPence: l.creditPence ?? 0,
            description: l.description ?? null,
          })),
      },
    },
  });
}

/** Standard account names the journals use, an accounting sync maps these once. */
export const JOURNAL_ACCOUNTS = {
  stock: "Stock on Hand",
  cogs: "Cost of Goods Sold",
  grni: "Goods Received Not Invoiced",
  adjustments: "Stock Adjustments",
  wip: "Work in Progress",
  overheadAbsorbed: "Production Overhead Absorbed",
} as const;
