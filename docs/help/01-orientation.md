# Orientation: what this app is (and isn't)

> `Fifteen pages, three headline calculations`

> **Tip:** Just want to get something done? Jump to [How do I…?](./03-how-do-i.md), the complete task index: every job in the system as a user would ask it, with exact button-by-button steps.

 Ordo covers the buy side: **Suppliers**, **Products** (with virtual **Bundles**), **Purchase Orders** with **landed costs**: the sell side: **Customers**, **Sales Orders** with dispatch and **Invoicing**, and a **Reports** dashboard: plus consolidated **Stock** across configurable **Warehouses** and per-channel **stock-feed rules**. Deliberately absent: accounting and logins, QuickBooks stays the ledger, the 3PL's WMS stays the warehouse floor.

The three calculations that make it worth a demo:

| Engine | What it does | Where you see it |
|---|---|---|
| Landed cost allocation | Spreads a freight/duty/handling invoice across PO lines, even across two POs sharing one container, penny-exact, by value, quantity or weight. | Cost Invoices, Purchase Order detail, Stock, Product detail |
| Channel rules | Turns raw stock into a channel-specific feed: thresholds, buffers, divides, e.g. Very's “≤5 is out of stock, else quantity ÷ 4”. | Channels (rule builder, live preview, CSV download) |
| Margin at landed cost | Dispatching a sales order snapshots each line's COGS at the average landed cost, margin reporting uses what stock really cost, not the supplier price. | Sales Orders, Reports |

> **Note:** House rule All money is stored as whole pence and weights as whole grams. That's why invoice splits always reconcile to the penny, there are no floating-point crumbs to lose.
