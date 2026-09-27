# Credits

> `/credits · raised from an invoiced sales order`

The financial register. Most credits now **raise themselves** when a customer return is received; the manual dialog remains for refunds without goods coming back (pricing errors, goodwill).

## Raise a credit note

1. Open an **invoiced** sales order and click `Create credit`.
2. Enter a quantity per line, capped at what's left to credit (the dialog shows "remaining" and what's already been credited). The unit price defaults to the order price; lower it for a partial-value refund.
3. Give a **Reason** ("Damaged in transit").
4. Decide the type: tick **Restock returned goods** and pick a warehouse if the items came back: stock returns (bundles explode to components) and the COGS snapshot reverses. Leave it unticked for a **write-off**: the refund reduces revenue but the cost stays spent.
5. Click `Raise credit note`, it gets a `CRN-` number at net + 20% VAT and appears on the order and in the Credits register.

| Type | Stock | Revenue | Cost | Margin effect |
|---|---|---|---|---|
| Restocked | Returns to warehouse | ↓ | ↓ | Sale mostly unwinds |
| Write-off | No movement | ↓ | unchanged | Margin takes the full hit, correct, the goods are gone |

> **Careful:** One-way door Credit notes can't be deleted or edited, like dispatch, they record something that physically happened. Over-crediting is blocked per line.
