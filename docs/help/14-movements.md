# Stock Movements

> `/movements · also on every product page`

The append-only ledger: every event that ever changed stock, written **in the same transaction** as the change itself. Complete visibility: a stock number is never just a number, it's the sum of its history.

## Read the ledger

1. Each row is one event: date, product, warehouse, **event type**, the **document that caused it** (click through to the PO or order), the **signed quantity** (green in, red out) and the **running balance after**.
2. Filter by event type or warehouse, and search by SKU or document ref, "show me everything DSP-0008 did" is one search.
3. Every product page carries its own recent movement trail, so "why is this number 254?" is answered right where you're looking.

| Event | Direction | Written by |
|---|---|---|
| Opening balance | + | Stock take-on, seed or the opening-stock import |
| Adjustment | ± | Stocktake variance / damage, from the Adjustments module |
| Warehouse transfer | ± | Paired out/in under one TRF reference |
| PO receipt | + | Receiving a purchase order |
| Despatch | − | Despatching a shipment (bundles logged per component) |
| Credit restock | + | A restocked credit note |
| Adjustment | ± | Reserved for the manual adjustments module |

**The guarantee** For every product × warehouse, the sum of its ledger rows equals the current stock level, and each row's running balance is consistent, verified in the seed. If the ledger and the level ever disagreed, that would be a bug, not an interpretation.
