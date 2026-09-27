# Testing Playbook

Every module: what it does and how to prove it works, using the seeded demo data so each check is concrete. Work through it top to bottom to know the system's full capability, and note anything you expected that is not here, that list becomes the roadmap. Sign in as `steve@supplylens.co.uk` / `demo1234`. Reset any time with `npx prisma db seed`.

## The invariants (true at all times, any screen)

1. **Ledger equals reality**: for any product and warehouse, the sum of its movement rows equals the stock level shown, and running balances are consistent.
2. **Journals balance**: every stock journal's debits equal its credits; a journal never exists without its physical event (same transaction).
3. **Money is exact**: all totals are integer pence; allocation splits sum exactly (£100 across 3 = 33.34 + 33.33 + 33.33); net + VAT = gross on every document.
4. **Statuses are canonical**: renaming labels in Settings changes screens, never behaviour or the API.
5. **Derived states cannot go stale**: fulfilment, back orders, bundle availability, payment status are computed live, there is nothing to forget to update.
6. **Automated floor**: 113 unit tests cover the pure engines (allocation, channel rules, replenishment, fill rates, production cost, back orders, FEFO and receipt progress, carriage accrual and variance, CSV, crypto); `npm run check` must be green before any feature counts as done.

## Dashboard

1. Overview tiles: Sales orders total equals the register's row count; Units sold (12 months) equals the sum of DESPATCH movements over the window; Out of stock lists only physical products at zero or below.
2. Chart: every month of the last twelve has bars (the seeded trading year); Nov and Dec peak on homeware, Jun on garden; hover titles show exact pence-derived figures; the current month includes the live demo period.
3. Despatch and invoice an order, refresh: Units sold, Profit (12 months), and the current month's bars all move together.

## Identity, organisation, and users

1. Open any page signed out: expect redirect to sign-in. Wrong password: one generic error (no hint whether the email exists).
2. Settings → Users: invite an email as Member, copy the link, open it in a private window, set a password: expect to land signed in on the dashboard. Re-open the used link: expect "already been used".
3. As that Member, open Settings: expect the organisation and user management to be read-only (no invite form, no remove buttons).
4. Try removing yourself or the owner as an admin: expect refusal.

## Products (types, families, packs, barcodes)

1. Search "tong" in the products list; edit via the row pencil AND via Edit product on its detail page: same form.
2. On `GRD-TONGS-01` detail: pack configurations show PACK6 with outer barcode 5060871330288; landed cost tranches list opening stock + PO receipts with a weighted average; movements trail at the bottom.
3. Try giving another product barcode 5060871330028: expect refusal (barcodes are unique).
4. Blanket family: expect variants grouped under one header in the list, and the variant pill bar on any variant's detail page.

## Bundles & BOMs

1. `BDL-BBQ-STARTER`: derivation table shows the constraining component; try adding a bundle as a component of another: expect refusal.
2. `HMW-HAMPER-01` (assembled): the editor shows "This recipe makes [1]", change it to 5, save, then open Production → New build for 7: expect component needs rounded UP (partial batch) and the batch hint shown. Set it back to 1.

## Purchasing: POs and cost invoices

1. Place then receive `PO-0003` into Northampton: stock rises, PO locks, movements gain PO_RECEIPT rows, and the pending hold RSV-0003 flips to ACTIVE in the same moment.
2. Add a £100 FREIGHT cost invoice on PO-0001+PO-0002 (weight basis): allocations sum to exactly £100, average landed costs move LIVE on Stock and product pages, and a LANDED_COST journal appears (Dr Stock / Cr Landed Costs Clearing).
3. Delete that invoice: averages fall back and a reversing journal nets the uplift to zero.
4. Replenishment: three SKUs need ordering (lantern worst); Raise the buys creates a draft PO per supplier pre-filled at landed cost; suggestions net off the PO once placed.

## Goods in: partial deliveries, batches, FEFO

1. Goods-In Station: PO-0004 shows Part received with 180 ginger outstanding; the elderflower line is absent (fully received lines drop off).
2. Scan `5060871330158`: the ginger line highlights and pre-fills 180. Scan `5060871330011` (fire pit): refused, not on this order.
3. Receive 100 with lot `GIN-TEST`: expect the PO to STAY Part received (80 left), a new GRN in the Deliveries card, and a balanced Dr Stock / Cr GRNI journal for exactly 100 × 82p = £82.00 on the journal feed.
4. Try to receive a batch-tracked line with the lot blank at the station: blocked with "Enter a batch for…".
5. Product DRK-ELDER-750 → Batches card: two lots, 120 each, the earlier best-before listed first. Sum equals the Stock page on-hand (240).
6. Despatch the drinks order at the station: pick list and line notes say take ELD-2547 first; after confirming, Movements shows the despatch split across lots (120 from ELD-2547, the spill from ELD-2551) and availability nets to zero drift (ledger equals stock level).
7. API: `POST /purchase-orders/PO-0004/receipts` with a partial lines array returns the GRN reference and PARTIALLY_RECEIVED; an empty body receives the rest and returns RECEIVED; a third call returns duplicate: true.
8. Delete guard: a part-received PO cannot be deleted ("Orders with received stock cannot be deleted").

## Sales orders (the deep one)

1. Tags: the seeded Mirakl draft carries *marketplace* and *priority* chips (order) and *fragile* (blanket line); they appear on the order page, the station queue and line, and the printed pick list. POST an order with duplicate and padded tags (" Prime ", "prime"): the readback shows them trimmed and de-duplicated; PATCH tags replaces the list, null clears it.

1. Create an order: customer defaults pre-fill salesperson/warehouse/location; product picker is type-to-search; pick tongs then unit PACK6: price scales to the pack and "= N ea" appears.
2. Amend a draft's quantity without a reason: expect refusal; with a reason: Original column stays, Confirmed goes amber, amendment history logs it, fill rates update. See `SO-0016` for the 100 → 80 → 75 story (80% / 75% / 93.75%).
3. Order 200 fire pits (any customer): Back order badge + amber card; Cover shortfall raises a linked draft PO and a hold; PO page lists the waiting order; receive the PO: hold activates, back-order state clears itself.
4. Tax: an INCLUSIVE order extracts VAT from entered prices; net + VAT = gross exactly.
5. Pre-order flag: quantities excluded from channel feeds and undespatchable by anyone else, even after new stock lands.

## Despatch, invoicing, payment

1. Despatch flow on any open order: create despatch (capped at outstanding) → mark picked → despatch with tracking. Stock falls, COGS snapshots at average landed, DESPATCH_COGS journal written, fulfilment badge derives (try a partial for PARTIAL).
2. Invoice requires full despatch; due date = invoice date + customer terms; mark paid / unmark; an overdue invoice shows OVERDUE with no one setting it.
3. Despatch Station: queue → start picking SO-0017 → print pick list (bundles explode to component rows) → scan outer barcode 5060871330288 (counts a pack of 6), scan fire pit 5060871330011 (refused, not on order) → short-pick allowed → pack (weight prefilled) → mock DPD label → confirm. Then check Movements and the pending COGS journal.
4. Batch pick: tick two orders → Print job list: one consolidated grab list with per-order attribution.

## Returns and credits

1. RMA on a despatched order (capped at despatched minus already returning); receive with a restock/write-off split: restock hits stock + ledger + reverses COGS, the credit note raises itself, write-off refunds money only.
2. Over-credit guard: crediting more than ordered-minus-credited on a line is refused.
3. RTV: create for a supplier, send it: stock leaves, SUPPLIER_RETURN journal books Supplier Credits Due.

## Production

1. Start seeded draft `BLD-0002` (40 hampers): components leave stock into WIP; try planning a build bigger than component stock: red dots, and Start refuses.
2. Finish with fewer made than planned, one extra component used, and £20 build costs: stock deltas ledger with "over plan", finished hampers appear as a new cost tranche at a HIGHER unit cost than BLD-0001's £17.71 (yield loss + labour visible), journals balance, WIP nets to zero.

## Inventory: stock, movements, adjustments, transfers, reservations

1. Stock page: On hand − Committed − Reserved = Available on every row; bundle availability derived below.
2. Movements: filter any SKU and add the rows up: they equal the stock level. Every document type appears here.
3. Adjustment without a reason: refused; below zero: refused; a valid ± pair journals Stock ↔ Stock Adjustments at landed value.
4. Transfer NTH → LDS: paired −/+ ledger rows under one TRF reference; same-warehouse refused; more than on-hand refused. (No journal, correctly: no value moved.)
5. Reserve stock for a customer: it leaves Available and channel feeds; that customer's despatch consumes the hold automatically, oldest first.

## Channels & feeds

1. Very's rules: ≤5 in stock shows OOS with blank quantity, else quantity ÷ 4; edit a rule step and watch the preview recompute; download the CSV.
2. Feeds run on Available: reserve some stock and re-check the feed.

## Admin: settings, integrations, import/export

1. Portal: sign in as Jane (jane@harrods-demo.co.uk / demo1234), confirm tongs show £5.49 "your price", place a basket order and find it in Sales Orders on the b2b-portal channel; confirm a staff cookie cannot open /portal and Jane cannot open /dashboard; send an API order for HARW with no line prices and watch the list prices land.
2. Settings: rename DRAFT to "Held": every badge changes, the API still says DRAFT. Change the SO prefix to EQX: the NEXT order is EQX-numbered, old references untouched. Duplicate prefixes refused.
3. Integrations: generate a token (shown once), call the API with it, watch "last used" stamp, revoke it: 401. The dev key never works on the deployed site.
4. Import/export: export products, re-import unchanged (0 created, N updated, idempotent); import a file with one bad row: whole file rejected, every problem listed with row numbers; blank cells leave existing values unchanged; opening stock loads once then refuses with "use an adjustment".

## Carrier costs and true margin

1. Despatches register: DSP-0001 and DSP-0011 show *invoiced* chips (£41.75, £39.90), DSP-0012 shows *accrued £12.50*.
2. Carrier invoice PW-INV-30977: two consignments, variance +£3.25 (red) and −£2.10 (green); journal feed has the matching CARRIAGE_COST entries and a CARRIAGE_ACCRUAL per accrued despatch, all balanced.
3. SO-0001 Totals: Cost to serve £41.75 (invoiced) and True margin = Margin − 41.75; the percentages recompute against net.
4. Despatch any order with a Carriage cost of £45 at the station: expect a CARRIAGE_ACCRUAL journal for exactly £45.00 and an *accrued* chip.
5. New carrier invoice for that despatch at £51: variance journal £6.00; the order flips to invoiced cost to serve £51.00; revising expected carriage is now refused.
6. Delete that carrier invoice: a reversing journal appears and Cost to Serve nets to zero for the pair; the despatch returns to *accrued*.
7. Split test: one line, two despatches, split by order value: allocations sum to the line exactly (odd pennies included).
8. API: `POST /api/v1/carrier-invoices` resolving by tracking number returns 201; a re-send returns duplicate: true; an unknown tracking 422s naming the line.

## The API (curl or Swagger at /api-docs)

1. Intake: POST an order by barcode only; re-POST the same externalRef: `duplicate: true`. Unknown customer + unknown SKU together: ONE 422 listing both.
2. PATCH: change just the PO number: everything else retained; line quantity change without amendmentReason: refused.
3. Fulfilment: POST a despatch confirmation (packs by outer barcode): stock, COGS, journal, status all move in one call; re-send the same externalRef: duplicate. POST a PO receipt: holds activate; re-receipt: duplicate.
4. Accounting: GET pending stock-journals, POST one as posted with an external ref, re-post: duplicate. Confirm an invoice paid, re-confirm: duplicate.
5. Delta sync: note the time, change one order, GET with updatedSince: only that order returns.

## The grand tour (one unbroken story, ~15 minutes)

1. Use the **demo import pack** on the Import/Export page (nine ready-made CSVs, nothing to author) or import a new supplier and product via CSV → raise a PO for it and receive it in two deliveries at the Goods-In Station → add a freight invoice (watch the average move) → API-order it from a customer by barcode → despatch at the Despatch Station with a printed pick list → invoice it → mark paid → book an RMA for two units, restock one and write off one → confirm the auto credit → then read that product's ENTIRE story on Movements and the journal feed, every step you just took, in order, balanced.
2. If any step surprises you, that is either a bug (tell me) or a missing capability (roadmap it).

> **Tip:** What is deliberately absent while you test Multi-currency, org-scoped data (Next #1), webhooks (poll updatedSince instead), API pagination, image upload on the hosted site, CANCELLED status, and everything on the consciously-out list. Missing something not on either list? That is exactly the feedback wanted.
