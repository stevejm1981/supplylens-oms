# Roadmap

The tracked plan, mirrored from `ROADMAP.md` in the repo (the source of truth, this board updates with every release). Rule of the road: nothing gets built that isn't on here, and nothing ships without tests, a green `npm run check`, and this guide updated.

### Next, in order

- **1 · Multi-tenant data scoping**Every record owned by an organisation; per-org API keys. Identity Phase 2: required before two customers share a database.
- **2 · Webhooks / outbound events**Push order/stock/journal events to SupplyLens instead of polling.
- **3 · Integrations health page**Each channel vs its connection: last order in, last feed out, errors.
- **4 · API pagination**Platform citizenship before connectors run at volume.
- **5 · Order promising (ATP-lite)**Promise dates from stock or the covering PO's ETA (back orders + SO⇄PO cover: shipped).
- **6 · Accounting sync (Xero)**Drain the stock-journal outbox; push invoices/credits; paid confirmations return.

### Later

- **Deployment**Vercel + Supabase Postgres, Supabase Auth swap, supplylens-oms.co.uk.
- **Multi-currency**Currency + rate on documents; base-currency reporting.
- **DPD label integration**Real labels on the customer's account. Trigger: Equinox pilot.
- **Automation rules**Auto-despatch, auto-invoice, low-stock alerts.
- **Production Station**Tablet works-order flow for line-side consumption capture. Trigger: Equinox phase 3.
- **Production planning engine**Retailer forecasts + promotions into a production plan with material cascade. Trigger: Equinox planning track.
- **CANCELLED status · order-history import · warehouse routing · batch columns on opening-stock import · stocktake count sheets · carrier invoice CSV import · cost-to-serve reporting roll-ups · integration test harness**

### Shipped, 35 releases

- **Core OMS**Documents, landed costs, availability, ledger, returns, credits, back orders with SO⇄PO cover.
- **Integration surface**Full API + OpenAPI, barcode/pack intake, document and line text tags, fulfilment confirmations, accounting outbox.
- **Warehouse**Despatch Station, Goods-In Station with partial deliveries, batch/lot tracking with FEFO picking, pick lists, job lists, adjustments, transfers.
- **Intelligence**Replenishment forecasting, fill rates, margin at landed cost, true margin with cost to serve (carrier invoices matched to orders), the twelve-month expense vs profit dashboard, production orders with WIP costing.
- **Platform**Onboarding import/export, settings, identity & invitations, API tokens & integrations gallery, B2B portal with per-customer price lists, the Ordo brand system (two directions, light and dark), 113-test gate.

### Consciously out of scope

- POS · MRP / advanced manufacturing · bin/zone layouts (3PL territory) · invoice OCR
