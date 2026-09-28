# Known limits (on purpose)

> `Known boundaries, say them before the customer finds them`

| Limit | Why it's fine for now |
|---|---|
| No un-receive / editing received POs | Keeps stock history trustworthy; a real build would add reversal receipts |
| No editing cost invoices | Delete and recreate, allocations roll back cleanly |
| No bundle-of-bundle | Matches the 3PL's WMS and QuickBooks behaviour anyway |
| Shared bundle components double-count | Standard for virtual bundles; availability is advisory |
| No dated cost layers | With no sales orders, the weighted average is already exact; layers become necessary once outbound transactions exist |
| No un-despatch | Despatched stock has physically moved: raise a restocked credit to bring it back. Part-fulfilled orders invoice what shipped via the short-close |
| GBP only | Multi-currency (FX rates, base-currency reporting) is the known next step, tax treatment landed first because it bites harder in syncs |
| Credit notes are permanent | No edit/delete, they record real events; over-crediting is blocked per line |
| Families are one level | A family groups variants by label, no attribute matrix (colour × size) yet |
| Categories are flat, images live on local disk | No category tree, one image per product, stored under `public/product-images`, enough to validate the UX |
| Accounting connector not switched on | Invoices (with full lines) and balanced journals queue on the API ready for Xero or QuickBooks to drain; the connector itself is a SupplyLens flow |
| One delivery address per order | Structured ship-to snapshots from the location or customer default; no split shipments to different addresses on one order |
| No payment reminders | Overdue status derives live from the due date; chasing emails wait on the outbound comms layer |
| Single-organisation data | Users, roles, invites, and API tokens exist, but data is not yet scoped per organisation; multi-tenancy is the first roadmap item before commercial onboarding |

 Ordo University · matches the live build as of 27 September 2026 (v11: held-review quantities with amendment audit and fill rates, full API with OpenAPI/Swagger docs, inbound reservation holds, availability model, returns, delivery locations, stock ledger, despatch documents, tax treatment, credits, families, taxonomy, images, reports). Source of truth for the engines: `src/lib/engine/landed-cost.ts` and `src/lib/engine/channel-rules.ts`, pure functions with a Vitest suite (`npm test`).

# B2B Portal

> `/portal`

Your customers' buyers get their own login: the catalogue at **their prices**, stock as bands (In / Low / Out, never your exact position), basket ordering that lands as normal sales orders, order tracking, invoices with payment status, and returns requests. Fully separate identity from staff, a buyer login can never open the OMS and vice versa.

## Setting a customer up (staff side)

1. Customers page → the **£ icon** on their row: build their **price list** (price per each; packs derive automatically; anything unlisted falls back to standard price). Bulk-load via the `price-lists` CSV on Import/Export.
2. The **person icon**: invite buyer emails, copy the link, send it. Same invite-link pattern as staff invitations, revocable, seven-day expiry.
3. Payment terms on the customer record drive behaviour: terms above zero = ordering on account; terms of **zero** = orders arrive flagged PROFORMA and the buyer is told despatch follows payment. (Pay-now via a provider is the roadmap item that automates this.)

## What the buyer experiences

1. Demo login: `jane@harrods-demo.co.uk` / `demo1234` at `/portal`. Jane buys for Harrods Wholesale, who have list prices on three SKUs, tongs show **£5.49 "your price"** instead of £7.99.
2. Account home: her terms, outstanding and overdue balances, recent orders.
3. Catalogue: search, images, band chips, pack buttons priced per pack; the basket carries product, unit, and quantity only, **prices are always resolved server side**, a tampered basket cannot change what gets charged.
4. Checkout: pick a saved delivery location, add their PO number, place. The order lands in your Sales Orders as a draft on the **b2b-portal channel**, noted "Placed via portal by Jane Porter", and follows the standard held-review flow.
5. Orders: status, amended-quantity visibility (confirmed vs requested), shipments with tracking. Invoices: payment status and due dates. Delivered orders offer **Request a return**, which creates a normal AWAITING return for you to receive.

> **Tip:** One price brain The same price list drives the portal, pre-fills staff order forms, and prices API orders sent without a price, so a customer pays the same number through every door.
