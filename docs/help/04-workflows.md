# Workflows: every module, end to end

> `Click through each stage; every stage pairs the screen steps with the API payload that does the same job`

Each walkthrough below is one complete journey through a module, in the order a real document travels. Use the stage pills (or Next) to step through. The payloads are real, taken from the seeded fixtures, so you can copy any of them straight into Swagger and watch the walkthrough happen for real.

## Order to cash: the sales order, start to finish

### Create the order

**Screen:** `Sales Orders` → `New sales order`. Pick the customer first (salesperson, warehouse, prices pre-fill), choose the delivery location, add lines in eaches or cases, set the buyer's PO number and required date, `Create sales order`. It lands as a `Draft`, held for review.

**Integration:** the same order arrives from a channel as one POST, idempotent on `externalRef`. Cases resolve by their GTIN-14 outer barcodes:

`POST /api/v1/sales-orders`

```json
{
  "customer": "SAINSBURYS",
  "channel": "sainsburys-as2",
  "externalRef": "A19500075311",
  "customerPoNumber": "A19500075311",
  "location": "5010011090751",
  "taxTreatment": "NONE",
  "requiredDate": "2026-09-28",
  "shippingInstructions": "Z929901",
  "lines": [
    { "barcode": "15061051740149", "quantity": 13, "unitPricePence": 1332 },
    { "barcode": "15061051740224", "quantity": 1,  "unitPricePence": 1332 },
    { "barcode": "15061051740156", "quantity": 2,  "unitPricePence": 1088 },
    { "barcode": "15061051740200", "quantity": 9,  "unitPricePence": 1332 }
  ]
}
```

### Held for review: amend, re-route, cover

While the order is a draft you can change it honestly: `Amend confirmed quantities` (reason required, the customer's originals are kept forever), `Change warehouse` (until anything ships), and if stock is short, the amber back-order card offers `Cover shortfall, raise PO`, one draft PO per supplier, linked both ways, self-clearing when stock lands.

`PATCH /api/v1/sales-orders/A19500075311`

```json
{
  "warehouse": "LDS",
  "lines": [{ "sku": "ATB-CC-NAT-240", "quantity": 11 }],
  "amendmentReason": "Stock shortage, agreed with buyer"
}
```

### Despatch: the station or the 3PL

**Screen:** the order sits in the `Despatch Station` queue: pick with scans, pack with the expected carriage cost, label, `Confirm despatch`. Stock, COGS at landed cost, FEFO lot consumption, the carriage accrual, and the accounting journal all move in that click.

**Integration:** a 3PL confirms the same despatch in one call. Partials are normal; here the big line ships 11 of 13:

`POST /api/v1/sales-orders/A19500075311/despatches`

```json
{
  "externalRef": "3PL-SHP-A19500075311",
  "shippingService": "Chilled Network Overnight",
  "trackingNumber": "CHD-0075-88213",
  "expectedCarriagePence": 4250,
  "lines": [
    { "barcode": "15061051740149", "quantity": 11 },
    { "barcode": "15061051740224", "quantity": 1 },
    { "barcode": "15061051740156", "quantity": 2 },
    { "barcode": "15061051740200", "quantity": 9 }
  ]
}
```

The order flips to `Part fulfilled`; the 2 outstanding cases re-queue on their own.

### Invoice: full, or what despatched

Fully despatched → `Create invoice`. Short shipped and the balance is dead → `Invoice despatched`: bills exactly what shipped, short lines amend down (audited), the rest stops queueing. Net, VAT, and the due date from the customer's terms compute themselves.

The invoice is immediately readable with full line detail, ready for Xero or an EDI INVOIC:

`GET /api/v1/invoices/INV-0024` (response, trimmed)

```json
{
  "number": "INV-0024",
  "customer": "SAINSBURYS",
  "customerPoNumber": "A19500075311",
  "delivery": { "location": "5010011090751" },
  "lines": [
    { "sku": "ATB-CC-NAT-240", "quantity": 11, "uom": "CASE12",
      "unitPricePence": 1332, "lineNetPence": 14652 }
  ],
  "netPence": 30148, "vatPence": 0, "grossPence": 30148,
  "dueDate": "2026-10-27", "paymentStatus": "UNPAID"
}
```

### Get paid

**Screen:** `Invoices` → `Mark paid`. Overdue flags itself from the due date. In production the ledger app confirms the money instead:

`POST /api/v1/invoices/INV-0024/paid`

```json
{ "paidAt": "2026-10-25" }
```

Marking paid bumps `updatedAt`, so a delta sync (`GET /invoices?updatedSince=…`) picks the change up on its next pass.

### After-sales: returns and credits

Goods coming back → `Book customer return` on the order, receive with per-line restock or write-off, and the credit note raises itself. Money-only gesture → `Create credit note` with restock unticked. Reports nets every credit off automatically, and restocked goods return with their cost reversed.

## Procure to stock: buying, receiving, landed cost

### Raise and place the PO

`Purchase Orders` → `New purchase order`: supplier, lines, and the shared **container ref** when orders travel together. `Place order` when confirmed; placed stock shows as on-order in availability and replenishment. (Or skip the typing: `Replenishment` → `Raise the buys` drafts them from real velocity.)

### Receive delivery by delivery

**Screen:** `Goods-In Station`: quantities pre-fill to outstanding, scan to jump, batch and best-before captured for tracked products, `Receive delivery`. The PO walks `Part received` → `Received` on its own.

`POST /api/v1/purchase-orders/PO-0004/receipts`

```json
{
  "warehouse": "NTH",
  "notes": "First of two pallets",
  "lines": [
    { "sku": "DRK-GINGER-330", "quantity": 300,
      "batchRef": "GIN-8812", "bestBefore": "2026-12-24" }
  ]
}
```

Each delivery moves only its own stock and puts only its own value on the balance sheet (Dr Stock / Cr GRNI); inbound holds activate in the same transaction.

### Land the freight and duty

`Cost Invoices` → `New cost invoice`: pick the POs the bill covers, split by value, quantity, or weight, `Save & allocate`. Penny-exact, and every affected product's average landed cost re-prices immediately, even weeks after receipt.

### Read the cost truth

Open any product: the tranche table shows every receipt at its landed unit cost and the average that stock, margins, and journals all use. In Xero, the supplier's bill clears GRNI and freight bills clear Landed Costs Clearing; the [Financials Map](./34-financials.md) holds the full account-by-account story.

## Warehouse outbound: the Despatch Station shift

### Take the queue

Orders wait oldest-required first with channel tags and pre-order flags. Tick several and `Print job list` for one consolidated shelf walk; or `Start picking` the next order and `Print pick list`, tick-boxes, barcodes, pack conversions, and FEFO "Take lot" lines included.

### Scan to verify

Scan each item (product EANs and case GTINs both verify); wrong items and over-picks are refused on the spot. Short-pick if the shelf is short, the balance re-queues.

### Pack, cost, label

Weight pre-fills from the catalogue; enter the expected **Carriage cost** (what the carrier charges you). Generate the label (mocked DPD; the production build prints a real one on your account) and `Confirm despatch`.

### What that click did

Stock down (bundles as components, packs as units, FEFO lots named on the ledger), COGS snapshotted at average landed, the carriage accrued, order status and tracking updated, and a balanced journal queued for the books. A 3PL's API confirmation does exactly the same, which is why the two are interchangeable.

## Warehouse inbound: a delivery at the door

### Open the delivery's PO

`Goods-In Station` lists every inbound order with deliveries so far and units outstanding. `Receive` on the one at the door; check the warehouse selector.

### Scan, count, batch

Quantities pre-fill to outstanding, so a complete delivery needs no typing. Scan a barcode to jump to its line; batch-tracked products ask for the lot and best-before right there, typed once from the label.

### Receive and repeat

`Receive delivery`: a GRN documents exactly this van, stock lands with its lots, the PO stays queued until nothing is outstanding. The PO page's Deliveries card lists every GRN with its lots; the product's Batches card shows per-lot on-hand in FEFO order.

## Production: make stock from a recipe

### Plan the build

`Production Orders` → `Plan a build`: what, how many, where. The parts list fills itself from the BOM honouring the recipe yield ("makes 1000 per batch"), green or red dot per component before anything commits. `Plan build`.

### Start: components into the build

`Start build`: components leave stock into work-in-progress (Dr WIP / Cr Stock), costs snapshotted at average landed.

### Finish: one honest number

`Finish build` asks how many you actually made; open "adjust parts" for real consumption and "add build costs" for labour or machine time. Finished goods land at their true rolled-up cost, WIP nets to zero, and the new tranche joins the average.

## Cost to serve: carrier bills to true margin

### Accrue at despatch

The despatch dialog and the station's pack step take the expected **Carriage cost**; confirming accrues it (Dr Cost to Serve / Cr Carriage Accruals). API despatch confirmations carry `expectedCarriagePence` for the same effect.

### Match the carrier's weekly bill

`Carrier Invoices` → `New carrier invoice`: one line per consignment, tick the despatches it covered, split consolidated consignments by value, weight, or manual amounts. `Create and match`.

`POST /api/v1/carrier-invoices`

```json
{
  "reference": "PW-INV-88231",
  "carrier": "Palletways",
  "invoiceDate": "2026-09-26",
  "lines": [{
    "consignmentRef": "PW8827741",
    "amountPence": 9600,
    "method": "VALUE",
    "despatches": [{ "tracking": "PW8827741" }, { "order": "SO-0009" }]
  }]
}
```

### Variance and true margin

Only the variance journals (the bill itself clears Carriage Accruals in Xero, the outbound mirror of GRNI). Every order's Totals card now shows Cost to serve and **True margin**, revenue minus COGS minus carriage, and the despatches register shows accrued or invoiced per shipment.

## Returns, both directions

### Book the RMA

On the order: `Book customer return`, quantities capped at what shipped. The RMA waits under `Returns`. Portal buyers can request one themselves; it arrives the same way, marked Portal.

### Receive with triage

When the parcel lands, decide per line: restock (back into stock, cost reversed) or write off (stays in COGS, honestly). `Receive & credit` does both moves and raises the credit note itself.

### Supplier returns

Faulty goods go back with `New supplier return`: stock leaves, the expected credit is tracked as Supplier Credits Due until their credit note clears it.

## Channels and the trade portal

### Shape each channel's stock feed

`Channels`: stack rules per channel (hold back, divide, subtract, blank when out) with a live preview. Reserved and committed stock is already excluded before rules run.

`GET /api/v1/channels/very/feed`

```json
{ "items": [ { "sku": "GRD-TONGS-01", "quantity": 24 }, … ] }
```

### Give a customer the portal

`Customers` → person icon → invite by email. Buyers get the catalogue at their price-list prices with live stock bands, a basket that orders straight in (marked Portal), tracking, invoices, and return requests. Terms decide payment: 30-day customers order on account, zero-terms orders land proforma.

## The books: nothing to prepare at month end

### Journals write themselves

Every stock event with a value consequence writes a balanced journal in the same transaction: receipts, COGS, adjustments, returns, production, landed costs, carriage. They queue as PENDING in the outbox.

`GET /api/v1/stock-journals?status=PENDING`

```json
{ "items": [ { "reference": "SJ-0031", "type": "DESPATCH_COGS",
  "lines": [
    { "account": "Cost of Goods Sold", "debitPence": 30148 },
    { "account": "Stock on Hand", "creditPence": 30148 }
  ] } ] }
```

### Drain to the ledger app

The sync posts each journal to Xero and acknowledges back; invoices flow via the invoice register, payments confirm home:

`POST /api/v1/stock-journals/SJ-0031/posted`

```json
{ "externalRef": "XERO-MJ-8831" }
```

### Reconcile once, agree forever

Supplier bills clear GRNI, freight clears Landed Costs Clearing, carrier bills clear Carriage Accruals. The [Financials Map](./34-financials.md) is the account-by-account contract; because journals are born with their physical event, the books cannot disagree with the warehouse.

## Replenishment and back orders: the self-managing loop

### The signal

`Replenishment` computes velocity from what actually despatched (bundles exploded, packs converted), days of cover, and reorder points from each supplier's lead time. Suggestions already net off stock on order.

### One click buys

Tick the rows, `Raise the buys`: one draft PO per supplier at average landed cost, ready to review and place.

### Back orders clear themselves

An oversold order shows its amber card; `Cover shortfall, raise PO` links SO⇄PO with a customer-held hold that activates the instant goods are received. Nothing is a stored status, so nothing needs un-setting: stock arrives, the shortfall is simply no longer true.

> **Tip:** Copy any payload into Swagger `API Docs` → Authorize with a token from Integrations → paste the body into the matching endpoint → Execute, then watch the walkthrough happen on the real screens. Everything here runs against the seeded fixtures (`npm run seed:shopify`, `seed:morrisons`, `seed:sainsburys` restore them any time).
