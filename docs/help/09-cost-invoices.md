# Cost Invoices

> `/cost-invoices · /cost-invoices/new · /cost-invoices/[id]`

Where freight, duty and handling become part of your unit costs. The split is computed live in front of you before anything saves, and it always sums to the invoice, to the penny.

## Allocate an invoice

1. Click `+ New cost invoice`.
2. Fill the **Invoice** card: Reference, Vendor, Type (*Freight, Duty, Insurance, Handling, Other*), Amount in pounds, and **Allocate by**: see the table below for which basis to pick.
3. In **Purchase orders**, click the POs this bill covers. They're grouped by container ref, so “the whole container” is two clicks. Selected POs highlight in teal.
4. Watch the **Live allocation preview** on the right: every PO line with its share % and allocated £, updating as you type. The total always equals your amount exactly.
5. Click `Save & allocate`. The split is stored line-by-line and every landed figure in the app updates.

| Allocate by | Basis per line | Reach for it when… |
|---|---|---|
| Line value | qty × unit cost | Duty and other ad-valorem charges |
| Quantity | units | Per-unit handling, devanning |
| Weight | qty × unit weight | Freight, heavy items carry the bill |

> **Careful:** Equal-split fallback If the chosen basis is zero on every line (e.g. weight allocation but no weights captured), the preview shows an amber banner and splits equally. Fix the product weights rather than accepting the fallback.

## Audit the split

1. Open any invoice from the list to see the full breakdown: each line's basis, share %, allocated amount and per-unit uplift.
2. Read the reconciliation line at the bottom, “Allocations reconcile exactly to the invoice amount, no penny drift.” If it ever said otherwise, that's a bug worth shouting about.
3. Made a mistake? There's no edit: **delete the invoice** (bin icon on the list) and create it again. All landed figures roll back and re-apply cleanly.
