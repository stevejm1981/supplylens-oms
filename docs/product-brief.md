# Ordo product brief: the module map, honestly scored

Ordo, the order management system by Supply Lens. Every order, in order.

The leading SME OMS platforms share thirteen core modules. This is that map
with a fourteenth they all miss, scored against what Ordo already ships
today, so the v1 plan builds what is missing instead of re-planning what
exists. **Score: 7 modules built, 5 partial, 2 not built.**

Working draft · 27 September 2026 · scoring reflects the live build.

## The map

| # | Module | Seen in | Ordo today | What exists / what is missing | v1 priority |
|---|---|---|---|---|---|
| 1 | Channel connectors | Linnworks, Brightpearl, Cin7 | **Partial** | The connectors ARE SupplyLens, the moat competitors cannot copy. Ordo's side is complete: order intake (SKUs, barcodes, case GTIN-14s, tags, one-off ship-to), stock feeds with per-channel rules, despatch and receipt confirmations, invoice sync, CSV import. Missing: self-serve connector UI, sync health, webhooks (integrators poll updatedSince today). | Must |
| 2 | Order management | Linnworks, Brightpearl, Ordoro | **Built** | Unified queue, held-for-review with audited amendments, tags and notes at both levels, self-clearing back orders with SO to PO cover, partial fulfilment, invoice-what-despatched short-close, split shipments, movable warehouse. Missing: cancel status, split/merge orders, a timeline view (audit data exists). | Must |
| 3 | Automation engine | Brightpearl, Linnworks, Veeqo | **Not built** | The biggest true gap in the Must column. Conditions (channel, SKU, destination, value, payment status) to actions (route, tag, hold, carrier, alert); high-value/VIP/suspicious alerts. Share design vocabulary with SupplyLens flows. | Must |
| 4 | Inventory | Linnworks, Brightpearl, Cin7 | **Built** | Stock by location, allocation on order, derived availability that cannot drift, bundles, ledgered adjustments and transfers, batch + best-before with FEFO, per-channel feed rules. Missing: serial numbers (mark Later explicitly), low-stock notifications, stocktake count sheets. | Must |
| 5 | Fulfilment routing | Linnworks, Brightpearl, Ordoro | **Partial** | Warehouse per order from customer defaults, movable until anything ships, API override at intake. Missing: rules-based auto-routing and split-by-location; dropship/FBA are new concepts. | Must |
| 6 | Shipping | Veeqo, Brightpearl | **Partial** | Services, tracking, carriage-cost capture, end-to-end label flow with a specimen label; DPD scoped with a live customer trigger. Missing: the carrier integrations, selection rules, and customer emails (no outbound comms layer exists). | Should |
| 7 | Warehouse operations | Veeqo, Cin7 | **Built** | Despatch Station (scan-verified pick, pack, label, confirm), Goods-In Station (partial deliveries, batch capture), pick lists and consolidated job lists, FEFO take-lot suggestions. Missing bins only. Wins demos today; do not schedule as Later. | Must (done) |
| 8 | Purchasing and suppliers | Brightpearl, Ordoro, Cin7 | **Built** | Suppliers with lead times, container-centric POs, partial receipts with batches, replenishment with one-click buys, penny-exact landed costs. Missing: automatic dropship POs (pairs with module 5). | Should (done) |
| 9 | Returns | Veeqo, Brightpearl | **Built** | RMAs from order or portal, restock/write-off triage, self-raising credit notes, supplier returns with credit tracking. Missing: return labels and refund-status writeback to channel. | Should (done) |
| 10 | B2B and wholesale | Cin7 | **Built** | Retailer EDI proven this month (Morrisons EDIFACT, Sainsbury's TRADACOMS, GLN depots, case GTIN-14 ordering), trade portal, per-customer price lists, invoice API carries everything an EDI INVOIC needs. Missing: outbound ASNs and INVOIC formatting, both SupplyLens flows over existing data. | Should (done) |
| 11 | Finance and ERP sync | Brightpearl, Cin7 | **Partial** | Deeper than the competitors on data: balanced journal outbox born with every stock event, invoices with full lines over the API, payment confirmations home, a documented account map. Missing: the actual Xero/QuickBooks connector, a SupplyLens flow draining what already queues. | Should |
| 12 | Reporting | Brightpearl, Linnworks | **Partial** | Live dashboard (12-month expense vs profit), sales and margin at true landed cost, fill rates. Missing: SLA and exception reporting; forecasting beyond replenishment. | Should |
| 13 | Platform and admin | all | **Not built*** | *Orgs, users, roles, invites, per-integration API tokens exist. The sellable-service layer does not: org-scoped data (roadmap #1), audit log, notifications, GDPR erasure, onboarding, billing, webhooks. Nothing ships commercially before this. | Must, first |
| 14 | Costing and margin | **none of them** | **Built** | The module the market map misses and Ordo leads with: landed cost per unit, average landed costing, cost to serve (carrier invoices matched to orders), true margin per order, all flowing to the books automatically. This is why prospects churn off the named platforms. | Must (done) |

## The v1 build list (what is actually left)

1. **Platform and multi-tenancy** (13): org-scoped data, audit log, notifications, billing, GDPR. The commercial prerequisite.
2. **Automation engine** (3): conditions-to-actions rules plus alerting. The one Must module with nothing on the shelf.
3. **Connector productisation** (1): SupplyLens does the connecting; Ordo needs the self-serve face, sync health, webhooks.
4. **Order management completions** (2): cancel, split/merge, the timeline view.
5. **Shipping** (6): DPD first, selection rules, and the missing customer-email layer.
6. **Routing rules** (5): auto-route and split by stock coverage; dropship later.

## The wedge, in one sentence

Every platform on this map sells connectors and automation; only Ordo arrives
with the integration layer already running real EDI and marketplace traffic
(SupplyLens), and the cost truth (landed, cost to serve, true margin) that
none of them can show, which is the number the customer's accountant actually
asks for.
