# Goods-In Station: receiving at the door

> `/goods-in-station`

The inbound sibling of the Despatch Station: a tablet view of every placed purchase order, received delivery by delivery. The clipboard-and-retype loop becomes one capture at the door: scan the product, enter what actually arrived, record the batch and best-before where the product demands one, receive. Partial deliveries are the normal case, not an exception: the PO walks `Placed` → `Part received` → `Received` on its own as deliveries land.

## Receive a delivery (the seeded story)

1. **Open the queue.** `Goods-In Station` in the Warehouse group lists every inbound PO with supplier, expected date, deliveries so far, and units still to receive. The seed leaves `PO-0004` (Fenland Beverages) part received: two deliveries in, 180 bottles of ginger brew still on a van.
2. **Click `Receive`.** Each line shows ordered / received / outstanding, and the arrived quantity pre-fills to the outstanding balance, the receiver only edits lines that came up short.
3. **Scan to jump.** Type `5060871330158` (the ginger barcode) in the scan box and press Enter: the line highlights and fills. A barcode not on this order is refused in red, the wrong-goods-booked-in problem solved at source.
4. **Batch and best-before.** Both drinks are **batch tracked**, so the line asks for a lot reference (e.g. `GIN-8850`) and an optional best-before date. Untracked products never show these fields, nothing to skip for the homeware.
5. **Click `Receive delivery`.** One transaction: a goods receipt document (`GRN-0003`) is created, stock lands with its lot on the movement ledger, any inbound holds waiting on the PO activate, exactly this delivery's value journals Dr Stock / Cr GRNI, and the PO flips to Received because nothing is left outstanding.
6. **See the trail.** The PO page now lists every delivery with its lots; the product page's **Batches** card shows per-lot on-hand in FEFO order, derived live from the ledger; Movements shows the receipt rows lot by lot.

> **Tip:** FEFO closes the loop Receive lots at the door and the outbound side uses them automatically: pick lists and the Despatch Station say "Take lot X (BBE…)" oldest first, and confirming a despatch consumes those exact lots on the ledger, so "which orders got batch X?" is one Movements filter, recall traceability without a single extra keystroke.

> **Note:** Costing stays simple on purpose Batches are a traceability and pick-ordering layer. Value stays average landed cost at product level, so the financials behave exactly as before, now including per-delivery GRNI journals for part receipts.

> **Note:** The API does the same job `POST /api/v1/purchase-orders/PO-0004/receipts` with a `lines` array (sku or barcode, quantity in base units, batchRef, bestBefore) books a partial delivery; with no lines it receives everything outstanding, so existing integrations keep working unchanged.
