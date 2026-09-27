# Known limits (on purpose)

> `Known boundaries, say them before the customer finds them`

| Limit | Why it's fine for now |
|---|---|
| No un-receive / editing received POs | Keeps stock history trustworthy; a real build would add reversal receipts |
| No editing cost invoices | Delete and recreate, allocations roll back cleanly |
| No bundle-of-bundle | Matches the 3PL's WMS and QuickBooks behaviour anyway |
| Shared bundle components double-count | Standard for virtual bundles; availability is advisory |
| No dated cost layers | With no sales orders, the weighted average is already exact; layers become necessary once outbound transactions exist |
| No partial dispatch or back-orders | An order dispatches whole from one warehouse, or not at all, shortage messages name the exact SKUs |
| No un-despatch, no partial invoicing | Despatched stock has physically moved (raise a restocked credit); an order invoices once, when fully despatched |
| GBP only | Multi-currency (FX rates, base-currency reporting) is the known next step, tax treatment landed first because it bites harder in syncs |
| No manual adjustments or transfers yet | The ledger has an Adjustment type reserved; the entry UI (stocktakes, damage, warehouse moves, opening balances) is the agreed next module |
| Credit notes are permanent | No edit/delete, they record real events; over-crediting is blocked per line |
| Families are one level | A family groups variants by label, no attribute matrix (colour × size) yet |
| Categories are flat, images live on local disk | No category tree, one image per product, stored under `public/product-images`, enough to validate the UX |
| Invoices stay in the register | QuickBooks push is deliberately stubbed, the SupplyLens platform already has that connector |
| No price lists per customer | Prices default from the product's sell price; per-line discount % covers negotiated pricing |
| One delivery address per order | Free-text address pre-filled from the customer, no multi-address book or split shipments |
| No overdue tracking | Invoices carry a due date but payment status/reminders are out of scope |
| No auth, no multi-tenant, no live standard virtual-bundle systems sync | It's a throwaway validation build, the engines are the part designed to graduate |

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
