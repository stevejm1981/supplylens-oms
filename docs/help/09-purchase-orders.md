# Purchase Orders

> `/purchase-orders · /purchase-orders/new · /purchase-orders/[id]`

Container-centric buying. A PO moves `Draft` → `Placed` → (`Part received` →) `Received`, and receiving is what puts stock on the shelf. Deliveries land one at a time at the Goods-In Station; the PO page's button receives everything outstanding in one go.

## Raise a PO

1. Click `+ New purchase order`.
2. In **Details**, choose the supplier and: this is the important habit: enter the **Container ref** (e.g. `MSCU-4821907`). Two POs sharing a container should share the ref exactly; that's how cost invoices later find them together.
3. In **Lines**, pick a product per row. The unit cost pre-fills from the product's base cost: override it with the actual quoted price. Add rows with `+ Add line`; the goods total updates as you type.
4. Click `Create purchase order`. It lands as a Draft, reference auto-numbered (`PO-0004`…).

## Place, receive, done

1. On the PO page, click `Place order` when it's confirmed with the supplier. (Drafts can still be deleted; placed orders can't.)
2. When the goods arrive, either receive the delivery at the **Goods-In Station** (partial quantities, batch capture) or, for the whole balance in one go, click `Receive all outstanding` here, pick the warehouse, and confirm. Stock is added to that warehouse, any **inbound reservation holds awaiting this PO activate in the same transaction**, and every delivery appears in the PO page's **Deliveries** card with its GRN reference and lots. Once nothing is outstanding the PO locks.
3. Check the **Lines & landed cost** table any time: base unit cost, then a tinted column per cost type (+Freight, +Duty, +Handling…), the landed unit cost, and the landed line total. Until invoices are attached it flags “no cost invoices allocated yet: landed = base”.

> **Careful:** Received means received There is no un-receive. If the numbers were wrong, that's a conversation before you click, not after.

> **Note:** Costs can arrive late, that's fine You don't need the freight bill before receiving. Attach it days later via Cost Invoices and every landed figure recalculates.
