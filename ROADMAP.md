# SupplyLens OMS, Roadmap

The tracked plan. Every feature moves **Later → Next → Now → Shipped**; nothing
gets built that isn't on here first, and nothing ships without meeting the
Definition of Done in `CLAUDE.md` (tests added, `npm run check` green, University
updated, this file updated).

**Positioning:** integration-first. *SupplyLens is the pipes, the OMS is the
truth, including the cost truth.* Not an Unleashed/Cin7 feature-parity race;
the differentiators (API, forecasting, RMA, ledgered stock, accounting outbox)
are standard core, not add-ons.

---

## Now

*(empty, next item is pulled from Next when work starts)*

## Next (in order)

1. **Multi-tenant data scoping (identity Phase 2)**, `orgId` on every data
   table, every query filtered by the signed-in user's organisation, per-org
   API keys. Mechanical but wide; required before two real customers share a
   database. (Phase 3 at deploy: Supabase Auth swap + row-level security.)
2. **Webhooks / outbound events**, order created, despatched, stock changed,
   feed changed, journal pending → pushed to subscriber URLs so SupplyLens
   flows trigger instantly instead of polling `updatedSince`.
3. **Integration sync health**, on the Integrations page (gallery + tokens
   shipped v27): per-connection last order in, last feed pull, last despatch
   confirmation, error counts. Makes "side by side" visible to the customer.
4. **API pagination**, cursor/limit on all registers. Platform citizenship
   before any real connector runs at volume.
5. **Order promising (ATP-lite)**, promise dates at order entry and via API:
   in stock → promise now; back-ordered → promise from the covering/earliest
   inbound PO's ETA. (Back orders + SO⇄PO cover shipped v28.)
6. **Accounting sync (Xero)**, a SupplyLens flow draining the stock-journal
   outbox and pushing invoices/credits; invoice `POST /paid` already exists
   for the return path.

## Later

- **Deployment phase 2**: product image uploads to Supabase Storage (uploads
  currently fail on Vercel's read-only filesystem; seeded images deploy fine
  as static assets), domain supplylens-oms.co.uk, Supabase Auth swap.
- **Multi-currency**, currency + exchange rate on POs and sales orders,
  reporting converted to base at document rate. Needed for USD-buying pilots.
- **CANCELLED order status**, a canonical terminal state (today: drafts
  delete, lines short-cancel to 0). Touches many guards; do deliberately.
- **Automation rules layer**, "when X then Y": auto-despatch fully-stocked
  orders, auto-invoice on despatch, low-stock alerts.
- **Warehouse routing rules**, auto-pick / split despatch warehouse by stock
  coverage. Only when a prospect actually has multi-site fulfilment.
- **DPD label integration**, replace the Despatch Station's mock label with
  DPD's shipping API on the customer's own account. *Trigger: Equinox pilot.*
- **Portal payments via provider** (Stripe/GoCardless): pay-now on proforma
  orders from zero-terms customers; the payment webhook releases the draft.
- **Line-level transaction exports**: one-click CSVs of sales order lines,
  PO lines, and stock movements (itemised, not header-level), the
  spreadsheet-friendly answer to "where do I download itemised lists?", which
  legacy platforms answer with report-scraping and manual column mapping.
- **Production Station**, the tablet works-order flow for line-side
  consumption capture: consume components batch by batch as the line runs,
  complete the assembly live, line-side label printing.
  *Trigger: Equinox phase 3.*
- **Production planning engine**, retailer forecast ingestion combined with
  promotions into a production plan, recalculating material requirements
  when anything changes. *Trigger: Equinox planning track (their current
  platform's forecasting module has no API).*
- **Batch columns on opening-stock import**, take-on balances landing as
  lots with best-before dates for batch-tracked go-lives.
- **Carrier invoice CSV import**, parcel-scale billing files (one row per
  tracking number) loaded straight into a carrier invoice. The pallet-scale
  manual matching shipped v38; this is the DPD-volume version.
- **Cost-to-serve reporting**, carriage cost and true margin rolled up by
  channel and customer on Reports (per-order true margin shipped v38).
- **Stocktake count-sheet mode**, export a count sheet per warehouse
  (SKU, expected, blank "counted" column), import it back → one variance
  adjustment document, fully ledgered. Today: full counts via Adjustments.
- **Sales-order history import**, open orders at cutover for migrations that
  can't start clean.
- **Scale hardening**: materialised availability counters (maintained in the
  same transactions as stock moves, replacing the walk-everything computation),
  cached average landed costs, and query/index review, due when a real tenant
  approaches thousands of open order lines. The infrastructure (Vercel +
  Supabase) is not the constraint; these computations are.
- **Integration test harness**, vitest suite against a scratch SQLite file
  exercising the transactional flows end-to-end (despatch, receipt, RMA,
  adjustment) the way the tsx verification scripts do by hand today.

## Consciously out of scope

POS, MRP / advanced manufacturing (virtual bundles are the deliberate model),
bin/zone/rack warehouse layouts (3PL territory), invoice OCR.

---

## Shipped

| v | Feature |
|---|---|
| v1-v5 | Core: suppliers, products, POs, landed-cost allocation (largest-remainder, penny-exact), on-demand average landed cost, bundles/BOMs, per-channel stock-feed rules, warehouses |
| v6-v8 | Sales orders (salesperson, customer defaults), despatch documents (NetSuite-style pick/despatch), invoicing, credits, reporting dashboard |
| v9-v10 | Product families/variants, categories, brands, images; channels as integration sync keys; order enrichment (delivery, shipping, gift, PO number); tax treatment (inc/ex VAT) |
| v11 | Stock movement ledger (append-only, in-transaction, running balances) |
| v12 | Returns: RMA with restock/write-off triage + auto credit; supplier returns (RTV); customer delivery locations with API sync codes |
| v13 | SOH/committed/available; pre-order stock securing; inbound-PO holds activating on receipt |
| v14 | Full REST API: code-based resolution, idempotent intake, PATCH merge semantics, `updatedSince`, OpenAPI + Swagger; held-review model (originalQty, amendments, fill rates) |
| v15 | Barcode line matching (EAN/GTIN, unique) |
| v16 | Pack UoMs: outer/case GTINs, per-line conversion snapshots, base-unit stock truth |
| v17 | Stock adjustments + warehouse transfers as documents; onboarding import/export (9 entities, all-or-nothing, idempotent, PATCH-semantics) with on-page mapping docs |
| v18 | Replenishment/forecasting: ledger-based velocity, days of cover, reorder points, one-click draft POs |
| v19 | Inbound fulfilment API (despatch confirmations, PO receipts); stock-journal accounting outbox (Dr/Cr at avg landed, PENDING→POSTED ack loop) |
| v20-v22 | Despatch Station (pick queue, scan-verify incl. outer barcodes, mock DPD label, confirm); printable pick lists; consolidated batch-pick job lists |
| v23 | Searchable product comboboxes everywhere |
| v24 | Settings (doc number prefixes, status display labels over canonical codes, default tax treatment); invoice payment tracking (paidAt, UNPAID/OVERDUE/PAID, API paid confirmation) |
| v25 | Test hardening (53 unit tests over all pure engines + money/CSV libs), `npm run check` gate, this roadmap |
| v26 | Identity Phase 1: organisations (name/VAT/address), sign-up (creates org + owner), sign-in/out, sessions, roles (owner/admin/member), invite-by-link with accept flow, gated app, Settings org & users cards |
| v27 | API tokens (generate/revoke, shown once, SHA-256 at rest, last-used) + Integrations page: connection catalogue with Connected/Ready/Available statuses and sync keys |
| v28 | Back orders: derived (never stored) shortfall state, "Cover shortfall" raising linked draft POs + customer-held inbound holds, SO⇄PO clickable both ways, self-clearing on any stock arrival |
| v29 | Dark auth surface with resilient constellation; copy style sweep (Oxford punctuation, no en or em dashes, zero third-party brand names) |
| v30 | Deployed: Postgres (Supabase shared pooler) everywhere including local dev, fresh init migration, pg adapter, build runs generate + migrate + next build, repo pushed to GitHub, Vercel wired |
| v36 | B2B portal: invite-only buyer logins per customer, catalogue at price-list prices with stock bands, basket ordering onto the b2b-portal channel (proforma drafts for zero-terms customers), order tracking, invoices and credits with account balances, returns requests; per-customer price lists across the OMS, order forms, imports, and priceless API intake |
| v32 | Financial completeness audit: landed-cost invoices journal stock uplift (with delete reversal), receipts include pre-allocated costs, supplier returns journal Supplier Credits Due, opening-stock imports write take-on journals; the Financials Map in the University |
| v37 | Batch/lot tracking + FEFO and the Goods-In Station: batch-tracked products, lots created at receipt with best-before, per-lot balances derived from the ledger, FEFO despatch consumption with take-lot suggestions on the station and both pick lists, recall drill from the product batches card; goods receipts (GRN documents) with partial deliveries walking POs PLACED, PARTIALLY_RECEIVED, RECEIVED; per-delivery GRNI journals and pro-rated landed-cost uplifts; receipts API accepts partial lines with batches |
| v38 | Carrier costs (cost to serve): expected carriage accrued per despatch (station and office, CARRIAGE_ACCRUAL journals), carrier invoice documents matched to despatches by tracking or order with consolidated consignments split by value, weight, or manual amounts, variance-only CARRIAGE_COST journals (the carrier's bill clears Carriage Accruals in the ledger app, mirroring GRNI), true margin per order (revenue minus COGS minus carriage) on order totals, carriage chips on despatches, API intake and register |
| v39 | Dashboard overview: eight live tiles (inventory value and units, products, orders, customers, out of stock, units sold over 12 months, open POs, 12-month profit) plus an expense vs profit chart pairing COGS-plus-carriage against invoiced revenue month by month for the last twelve; seeded with a paid, net-zero-stock year of trading history so the seasonal ebb and flow is visible |
| v40 | Order and line text tags: free labels from external channels (or the form) stored on sales orders and lines, normalised (trimmed, de-duplicated, capped), shown as chips on the order page, Despatch Station queue and lines, and printed pick lists; API intake and PATCH carry them at both levels (replace on send, null clears); display only, never behaviour ; API intake also accepts an explicit fulfilment warehouse code (falls back to customer default, then org default) and a one-off D2C ship-to (deliveryAddress/deliveryContact) |
| v31 | Production orders: DRAFT/IN_PROGRESS/COMPLETED lifecycle, ASSEMBLED product type, components into WIP at start, actuals + absorbed build costs (labour/machine) at completion, finished tranches at true rolled-up cost, operator-first three-button UI, API register; recipe-yield BOMs ("this recipe makes N units") with batch-aware planning |
