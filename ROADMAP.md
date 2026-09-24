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

1. **Batch / lot tracking + FEFO**, lots created at PO receipt (batch ref,
   received date, best-before); stock, availability and despatch consumption
   gain a lot axis; Despatch Station pick lists show "take lot / BBE"; FEFO
   pick suggestions; recall traceability ("which orders got batch X?").
   *Trigger: food & drink prospects (Equinox call). Also unlocks physical FIFO.*
2. **Multi-tenant data scoping (identity Phase 2)**, `orgId` on every data
   table, every query filtered by the signed-in user's organisation, per-org
   API keys. Mechanical but wide; required before two real customers share a
   database. (Phase 3 at deploy: Supabase Auth swap + row-level security.)
3. **Webhooks / outbound events**, order created, despatched, stock changed,
   feed changed, journal pending → pushed to subscriber URLs so SupplyLens
   flows trigger instantly instead of polling `updatedSince`.
4. **Integration sync health**, on the Integrations page (gallery + tokens
   shipped v27): per-connection last order in, last feed pull, last despatch
   confirmation, error counts. Makes "side by side" visible to the customer.
5. **API pagination**, cursor/limit on all registers. Platform citizenship
   before any real connector runs at volume.
6. **Order promising (ATP-lite)**, promise dates at order entry and via API:
   in stock → promise now; back-ordered → promise from the covering/earliest
   inbound PO's ETA. (Back orders + SO⇄PO cover shipped v28.)
7. **Accounting sync (Xero)**, a SupplyLens flow draining the stock-journal
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
- **Stocktake count-sheet mode**, export a count sheet per warehouse
  (SKU, expected, blank "counted" column), import it back → one variance
  adjustment document, fully ledgered. Today: full counts via Adjustments.
- **Partial PO receipts**, receive line quantities across multiple deliveries.
- **Sales-order history import**, open orders at cutover for migrations that
  can't start clean.
- **B2B portal**, customer-facing ordering/tracking. The API serves this
  audience today; a portal is a product decision, not a gap.
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
| v31 | Production orders: DRAFT/IN_PROGRESS/COMPLETED lifecycle, ASSEMBLED product type, components into WIP at start, actuals + absorbed build costs (labour/machine) at completion, finished tranches at true rolled-up cost, operator-first three-button UI, API register; recipe-yield BOMs ("this recipe makes N units") with batch-aware planning |
