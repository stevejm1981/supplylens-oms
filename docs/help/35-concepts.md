# How the maths works

> `src/lib/engine, pure functions, 18 tests`

## Penny-exact allocation

 Every line gets a basis (value, units or grams). The invoice divides proportionally, amounts are floored to whole pence, and the leftover pennies go to the lines with the largest fractional remainders. Result: the split *always* sums to the invoice, £100.00 across three equal lines is £33.34 / £33.33 / £33.33, never £99.99.

## Average landed cost, computed on demand

 The average is never stored. It's rebuilt every time from *tranches*: opening stock at its opening cost, plus each received PO line at unit cost + (its allocated invoice pence ÷ quantity). Because it's always recomputed, an invoice attached weeks after receipt re-prices history automatically, no adjustment journal, no stale snapshot.

## Effective stock

 Standard SKUs: physical sum across warehouses. Bundles: min over components of ⌊component stock ÷ qty per bundle⌋. Channel rules run on effective stock, which is why bundles appear in feeds with sensible numbers.

## COGS snapshots & margin

 Average landed cost is a live number, it moves whenever cost invoices land. Margin can't be built on a moving number, so **despatch freezes it**: each despatch line stores the average landed cost at that moment (components summed, for bundles), and the order line carries the despatch-weighted average. Reports aggregate those frozen snapshots, so last month's margin doesn't rewrite itself when this month's freight bill arrives.

## Tax treatment

 Every order declares how its amounts were entered: **tax exclusive** (VAT added on top), **tax inclusive** (VAT extracted: net = entered ÷ 1.2), or **no VAT**. All reporting uses the ex-VAT net, whichever way prices came in, which is exactly the discipline that stops the classic Xero sync headache.

## FEFO, first expired first out

 A batch (lot) is identity only: reference, received date, optional best-before. Its on-hand is never stored, it is the sum of the ledger movements that name it, the same derived-never-stored rule as everything else. Picking sorts lots by earliest best-before (undated lots last, then oldest received, physical FIFO), takes from the front, and spills into the next lot when one empties. Costing is deliberately untouched: value remains average landed cost at product level, lots only decide *which physical stock leaves first* and let a recall ask "which orders got batch X?".
