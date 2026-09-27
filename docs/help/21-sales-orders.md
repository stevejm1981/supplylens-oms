# Sales Orders

> `/sales-orders · /sales-orders/new · /sales-orders/[id]`

The commercial document: what was agreed with the customer. Physical shipping happens on separate **despatch documents** (next module), NetSuite-style. The order flows `Draft` → `Open` → `Invoiced`, with a derived fulfilment badge (Unfulfilled / Part fulfilled / Fulfilled).

> **Note:** Text tags Orders and lines carry free text tags from external channels (or the form's comma-separated Tags field): shown as chips here, on the Despatch Station, and on pick lists; passed through the API untouched; never drive behaviour.

## Raise an order

1. Click `+ New sales order`.
2. **Pick the customer first**: their default salesperson and warehouse pre-fill instantly. Adjust either if this order is an exception.
3. Set the **Channel** if the order came through an integration (Mirakl Tesco, Very…); leave it on *Manual / wholesale* for orders you keyed yourself. In production the sync sets this automatically.
4. Fill the references: **Customer PO number** (wholesale invoices get rejected without it), **Channel order ref** (the marketplace's own order id) and **Required by** date.
5. Complete the **Delivery** card: pick one of the customer's **named locations** (the default pre-selects; its address and contact snapshot onto the order, still editable), plus shipping service, **shipping instructions** ("book in 48h ahead, tail-lift"), a **gift message** for consumer orders, and the **shipping charge**: carriage is added to the invoice.
6. Tick **Pre-order** if this is sold ahead of stock: its quantities are secured the moment they exist (see Reservations & Pre-orders).
7. Set **Amounts are**: Xero-style: *Tax exclusive* (VAT added on top, the wholesale norm), *Tax inclusive* (VAT extracted from the entered prices: how marketplace consumer orders arrive), or *No VAT*. The totals footer shows Net / VAT / Gross live under whichever treatment you pick.
8. Add lines: any product *including bundles*. The unit price pre-fills from the product's sell price; set a per-line **Disc %** for negotiated discounts: line nets, totals and margin all respect it.
9. Click `Create sales order`, it lands as a Draft with an auto-numbered reference (`SO-0015`…).

## Held for review: original vs confirmed quantities

1. Every line stores two quantities: **Original**: what the customer asked for, preserved forever: and **Confirmed**: what you will actually release. They start equal.
2. On a held (draft) order, click `Amend quantities`: set confirmed per line (0 short-cancels the line but keeps it visible), give a **required reason**, and confirm. Increases above the original are flagged amber for explicit approval.
3. Every change lands in the **Amendment history** card: when, line, old → new, reason, and whether it came from the UI or the API.
4. The Totals card then shows the three **fill rates**: confirmation fill (confirmed ÷ original), dispatch vs original, and dispatch vs confirmed: quantity-weighted with per-line caps so overdelivery can't hide a shortage. The worked example ships in the seed: SO-0016, 100 ordered → 80 confirmed → 75 despatched = 80% / 75% / 93.75%.

## Invoice

1. Once **every line has despatched** (see the next module), click `Create invoice`: it raises an `INV-` numbered invoice at net + VAT under the order's tax treatment, with a **due date** from the customer's payment terms, and locks the order as Invoiced.

> **Careful:** One-way doors Only drafts can be deleted. Despatched goods can't be un-despatched (raise a credit), and an order invoices exactly once, partial invoicing is a future step.

## Back orders: the shortfall that manages itself

1. An order the company can't currently supply shows a `Back order` badge and an amber card naming each short SKU, the missing quantity and its supplier. The state is **derived live** (outstanding vs available): nobody sets it, so nobody has to unset it.
2. Click `Cover shortfall: raise PO`: one draft PO per supplier is created for exactly the missing units, and each line is tied back to this order by a **customer-held hold awaiting that PO**. Clicking again can't double-buy: cover already raised is netted off.
3. **The link runs both ways.** The order's card lists its covering PO (click through, ETA shown); the PO page lists every sales order *waiting on it*; the Reservations register shows the same holds with their order links.
4. **Nothing needs manual management afterwards.** Receive the PO and: in the same transaction: the hold activates and the stock is secured for that order; despatch it and the hold consumes itself. Any other stock arrival (adjustment, transfer in, return) clears the derived back-order state the moment it lands, across every affected order at once.
