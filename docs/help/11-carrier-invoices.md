# Carrier Invoices: cost to serve

> `/carrier-invoices · /carrier-invoices/new · /carrier-invoices/[id]`

What carriers charge YOU for outbound deliveries, matched to the sales orders they delivered. This is the outbound mirror of cost invoices, and it closes a gap legacy platforms leave open: delivery costs can land on purchase orders (landed cost) but there is nowhere to put the carriage cost of a sales order, so cost to serve and true margin per order are unknowable. Here they are first-class.

## The loop

1. **Accrue at despatch.** The despatch dialog (and the Despatch Station pack step) has an optional **Carriage cost** field: what the carrier is expected to charge for that shipment. Confirming the despatch accrues it (Dr Cost to Serve / Cr Carriage Accruals) in the same transaction. This is NOT the shipping you charge the customer, that stays on the order as revenue.
2. **Where the number comes from.** Best: the 3PL supplies the rate per shipment (it rides the API despatch confirmation, or lands later via `PATCH /despatches/{ref}`). No rate from the 3PL? `Carrier Rates` holds your keyed rate cards (delivery postcode area picks the zone, consignment size picks the break): the matched rate suggests itself next to the carriage field, one click to use, and API confirmations sending `carriageUnits` apply it automatically. A "test a postcode" calculator on the page proves a card against the carrier's own paper.
3. **Match the carrier's invoice.** When the weekly bill arrives, `New carrier invoice`: enter the carrier's own invoice number, one line per consignment, and tick the despatches each line covered (search by order, tracking, or customer). A consolidated consignment covering several orders splits by order value, weight, equally, or manual amounts, using the same penny-exact allocator that splits freight across PO lines.
4. **Only the variance journals.** The seeded example: DSP-0001 accrued £38.50, Palletways charged £41.75, so £3.25 more cost books; the second consignment came in £2.10 under and reverses. In Xero, code the carrier's Bill to **Carriage Accruals**, exactly as supplier bills clear GRNI, and the account nets to the variances alone.
5. **True margin appears.** The order's Totals card now shows **Cost to serve** (accrued until invoiced, then actual) and **True margin** = net revenue minus COGS minus carriage. The despatches register carries an accrued / invoiced chip per shipment, so "has the carrier billed this order yet?" is a glance, not a reconciliation.

> **Tip:** Try it on the seed Open `PW-INV-30977` under Carrier Invoices: two Palletways consignments, one over accrual (+£3.25 in red), one under (−£2.10 in green). Then open SO-0001: Cost to serve £41.75 (invoiced) and the true margin line under the ordinary margin. DSP-0012 (the DHL shipment) sits accrued and uninvoiced, waiting for its bill.

> **Note:** API for the SupplyLens integration `POST /api/v1/carrier-invoices` takes the carrier's bill with lines resolving despatches by tracking number, despatch, or order reference, idempotent on the invoice reference; despatch confirmations accept `expectedCarriagePence` so a WMS can accrue at ship time. `GET` returns every allocation with its variance.

> **Careful:** Corrections Expected carriage can be revised until a carrier invoice covers the despatch (only the delta journals). After that, corrections belong on the carrier invoice: deleting one writes an exact reversing journal and frees its despatches to be re-matched.
