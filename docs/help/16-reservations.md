# Reservations & Pre-orders

> `/reservations · pre-order flag on the sales order`

The "secure it" machinery most inventory systems don't have. Two mechanisms, one guarantee: secured stock drops out of Available, and therefore out of every channel feed, and blocks everyone else's despatches.

## Pre-order flag (order-shaped holds)

1. Tick **Pre-order: secure the stock** when raising the order. Its quantities count as committed from the moment the order exists: including stock that hasn't arrived yet, which lands already spoken-for when the container is received.
2. Pre-order commitment shows in violet on the Stock page ("40 committed (30 pre)") and the order carries a **Pre-order** badge everywhere.

## Stock reservations (holds outside any order)

1. Click `Reserve stock`: product, warehouse, quantity (capped at what's genuinely available: you can't ring-fence stock already promised), a reason, an optional expiry, and optionally **who it's held for**.
2. A hold **for a customer** blocks everyone else but that customer's despatches ship straight from it: and **consume it automatically**, oldest first, releasing the hold as it's fulfilled. That's the full pre-order launch flow.
3. A **general hold** (no customer) blocks everything: right for launch buffers and stock you're protecting from channels. Release it manually, or let it expire.
4. **Shipment still on the water?** Set **Awaiting inbound PO** and pick the open PO: quantity is capped at what's actually inbound. The hold sits *Awaiting PO-0003* (not counted against today's stock), then **activates inside the same transaction as the PO receipt**: there is zero window where the landed goods are visible to a channel before the hold snaps on. It even follows the goods into whichever warehouse they're received.
5. Despatch shortage messages explain the maths: "need 30, only 23 usable (123 on hand, 10 committed to other orders, 60 reserved)".
**Why this matters** The classic failure: pre-sold stock lands, the channel feed sees it, and it's gone by lunchtime. Here the feed broadcasts *Available*, not on-hand, committed and reserved stock never reaches a channel in the first place.

## Worked example: the container on the water

 The scenario that breaks most systems: 120 fire pits are on a ship (PO-0003, open), a pre-order campaign is running, and none of that stock may be sold elsewhere when it lands. Here's the whole life of that stock:

| When | What you do | What the system guarantees |
|---|---|---|
| Ship at sea | Reserve 50 against the PO: `Reserve stock` → Awaiting inbound PO → PO-0003, held for The Range | Hold sits *Awaiting PO-0003*. Today's availability untouched, your current stock still sells normally |
| Pre-orders come in | Enter them as sales orders with the **Pre-order** flag (or they arrive via the API with `"preOrder": true`) | Each order's quantity is committed immediately, even though the stock doesn't exist yet |
| Container lands | Receive PO-0003 as normal | In one database transaction: stock increments, the ledger records the receipt, **and the pending hold activates**: zero window for a channel sync to see the goods unprotected |
| Channels sync | Nothing, feeds run on Available | Available = on hand − committed (pre-orders) − reserved (the hold). The campaign stock simply isn't offered |
| Pre-orders ship | Despatch The Range's orders as normal | Their despatches draw from the hold and **consume it automatically**, oldest first, releasing as fulfilled. Anyone else's despatch into that stock is refused with the maths spelled out |
| Campaign ends | `Release` whatever's left (or let it expire) | Remaining quantity flows straight back into Available and the next feed |

> **Careful:** Punt Date-promised ATP ("we can deliver 40 on 14 Oct") is the remaining layer, inbound holds and pre-order commitments already secure the quantities; the promise-date maths would sit on top.
