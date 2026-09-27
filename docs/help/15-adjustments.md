# Stock Adjustments & Warehouse Transfers

> `/adjustments · /transfers`

The two remaining ways stock legitimately moves outside a trading document: corrections and relocations. Both are documents in their own right, applied instantly, ledgered line by line, and never deletable. A mistake is fixed with a counter-document, so the audit trail is always the whole story.

## Adjustments: stocktakes, damage, shrinkage

1. Click `New adjustment`, pick the warehouse and give a **reason**: it's mandatory, because every adjustment line lands on the movement ledger with that reason attached.
2. Add lines with **± deltas**: `+2` for goods found, `−3` for breakages. Each line shows live on-hand and the resulting balance; a delta that would take stock below zero is refused.
3. Click `Apply adjustment`, stock moves and the ledger records an *Adjustment* row per line under one `ADJ-0001` reference, in the same transaction.

## Transfers: warehouse to warehouse

1. Click `New transfer`, choose **From** and **To** (they must differ) and add lines: capped at what the source physically holds.
2. Click `Transfer stock`: one transaction writes a **paired out/in** to the ledger under the same `TRF-0001` reference, and per-warehouse availability recalculates instantly on the Stock page.

> **Tip:** Bundles are barred Both documents work on physical (standard) SKUs only, a bundle holds no stock, so you adjust or transfer its components.
