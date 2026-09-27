# Returns

> `/returns · RMAs booked from a sales order, RTVs raised directly`

Both directions of the returns problem, each as its own document, the same commercial/operational split as orders and despatches. Goods movements hit the stock ledger; money follows automatically.

## Customer returns (RMA)

1. On an order with despatched goods, click `Book return`, quantities are capped at what actually shipped minus what's already on returns. Pick the warehouse it's coming back to and a reason. The RMA sits `Awaiting` while goods travel.
2. When the parcel lands, click `Receive` on the Returns page and **triage each line**: **restock** quantity (sellable: back into stock, COGS reverses) vs **write-off** quantity (binned: refunded but the cost stays spent). This split is the whole UK-returns game.
3. On receipt the **credit note raises itself** for everything that came back, at the discounted price paid, under the order's tax treatment: no double keying, no double stock movement.
4. Restocked units appear on the stock ledger as *Customer return* events; bundles come back as their components, mirroring despatch.

## Supplier returns (RTV)

1. Click `New supplier return`: pick the supplier (the product list filters to theirs), the warehouse it leaves from, quantities and the expected credit per unit (defaults to average landed cost).
2. It sits as a draft until you click `Mark sent`, stock is checked and deducted, and the ledger records *Supplier return* events. The expected supplier credit is recorded on the document.

> **Careful:** One-way doors, again Received RMAs and sent RTVs can't be deleted, goods physically moved. Awaiting/draft ones cancel freely.
