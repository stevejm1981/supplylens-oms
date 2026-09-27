# Stock

> `/stock`

Everything on hand, valued at what it actually cost to get here, and, crucially, how much of it you can actually still sell.

| Column | Meaning |
|---|---|
| On hand (SOH) | Physically in the warehouse |
| Committed | Outstanding on open orders (ordered − despatched, bundles exploded), a violet "(N pre)" marks pre-order holds |
| Reserved | Ring-fenced by stock reservations |
| Available | On hand − committed − reserved. **This is what channel feeds broadcast** and what despatches check. Negative shows red: you've oversold that warehouse |

1. **Physical stock** lists every product × warehouse with the availability columns above plus average landed cost and stock value. The footer totals your whole holding: the same number as the dashboard KPI.
2. **Bundle availability (derived)** sits below: each bundle's components and how many are buildable right now. Bundles never appear in physical stock: they don't exist until they're picked.
3. Click any SKU to jump to its tranche breakdown and see exactly why the average is what it is.
4. Stock only enters through documented events: PO receipts, credit restocks, opening balances: and every one is on the **Stock Movements** ledger (next module).
**The re-pricing demo, start to finish** Note a SKU's stock value → Cost Invoices → allocate a new bill to a received PO containing it → back to Stock. The average landed cost and value have moved. This is the feature their previous inventory platform charges four figures a year for.
