# Despatches

> `/despatches · created from a sales order`

The fulfilment documents: one per physical shipment, NetSuite item-fulfilment style. Each carries its lines' **ordered → picked → despatched** quantities, its own status pipeline, and its own tracking number. This is what makes split shipments and pick-and-pack possible.

## Fulfil an order

1. On the order, click `Create despatch`. Quantities default to everything outstanding, lower them to split the order across shipments. The order flips to *Open*.
2. The despatch starts in `Picking`. When the warehouse has picked, click `Mark picked` and confirm per-line picked quantities, short-picks leave the shortfall outstanding on the order.
3. Click `Despatch`, confirm the shipping service and enter the **tracking number**. Stock is checked and deducted in the order's warehouse (bundles explode to components), and each line's **COGS locks in at the current average landed cost**.
4. The order's fulfilment badge updates automatically: *Part fulfilled* while anything is outstanding, *Fulfilled* when everything has shipped. Margin columns appear on the order as lines despatch.
5. The **Despatches** page is the warehouse work queue: everything awaiting pick or despatch across all orders, with tracking for what's gone.
**The margin moment** A bundle line's COGS is the sum of its components' landed costs at despatch, the margin you see accounts for freight and duty automatically. Buy side and sell side sharing one cost truth.

> **Note:** Why a separate document This is how NetSuite (Item Fulfilment) and even Shopify (Fulfillment Orders) model it: the order records what was agreed, despatches record what physically happened, and order status is derived. Cancelling an unshipped despatch is safe; a despatched one isn't, that's a credit.
