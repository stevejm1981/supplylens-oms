# Invoices

> `/invoices`

Each invoice now tracks **payment**: Unpaid → Overdue (past its due date) → Paid, with the paid date stamped. Mark paid in the UI, or let the accounting sync confirm it via `POST /api/v1/invoices/{number}/paid`: Xero receives the money, the OMS hears about it, nothing is re-keyed. The status is derived from the dates, so it can never go stale.

The invoice register, every invoice raised from a dispatched order, with net / VAT / gross and running totals.

1. Scan the register: number, source order, customer, salesperson, invoice date, **due date** (from the customer's payment terms) and amounts. The footer totals the lot.
2. Click the order reference to jump back to the full order, lines, margin and the invoice card.

> **Note:** Syncing invoices out `GET /api/v1/invoices` returns the full financial document per invoice: customer and channel codes, the buyer's PO number, the delivery location with its sync code, and every line with quantities, units, prices, and nets, plus carriage charged. `?updatedSince=` delta-syncs (marking paid bumps the stamp, so payment changes flow), `?status=` filters UNPAID, OVERDUE, or PAID, and `GET /invoices/{number}` reads one back. Enough to build a Xero invoice or an EDI INVOIC from a single call.

> **Note:** Where this goes next In a full build these push straight into QuickBooks, the SupplyLens platform already has the QuickBooks invoice connector, so the prototype deliberately stops at the register.
