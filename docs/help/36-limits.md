# Known limits (on purpose)

> `Prototype punts, say them before the customer finds them`

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
| Families are one level | A family groups variants by label, no attribute matrix (colour × size) in the prototype |
| Categories are flat, images live on local disk | No category tree, one image per product, stored under `public/product-images`, enough to validate the UX |
| Invoices stay in the register | QuickBooks push is deliberately stubbed, the SupplyLens platform already has that connector |
| No price lists per customer | Prices default from the product's sell price; per-line discount % covers negotiated pricing |
| One delivery address per order | Free-text address pre-filled from the customer, no multi-address book or split shipments |
| No overdue tracking | Invoices carry a due date but payment status/reminders are out of scope |
| No auth, no multi-tenant, no live standard virtual-bundle systems sync | It's a throwaway validation build, the engines are the part designed to graduate |

 Ordo University · matches the prototype build as of 23 September 2026 (v11: held-review quantities with amendment audit and fill rates, full API with OpenAPI/Swagger docs, inbound reservation holds, availability model, returns, delivery locations, stock ledger, despatch documents, tax treatment, credits, families, taxonomy, images, reports). Source of truth for the engines: `src/lib/engine/landed-cost.ts` and `src/lib/engine/channel-rules.ts`, pure functions with a Vitest suite (`npm test`).
