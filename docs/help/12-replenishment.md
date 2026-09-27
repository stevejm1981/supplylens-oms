# Replenishment

> `/replenishment`

The anticipate-change module: it watches what actually ships and tells you what to buy before you run out. Forecasting runs on the **despatch ledger**: base units, bundles already exploded, packs already converted: so it measures physical outflow, not order paperwork.

## The maths (all visible on the page)

1. **Velocity**: base units despatched over the trailing **28 days**, shown as units/week.
2. **Days of cover**: Available ÷ velocity: how long today's sellable stock lasts at the current run rate.
3. **Reorder point**: velocity × (supplier lead time + **14 safety days**). When the stock *position* (Available + on inbound POs) falls to this, it's time to buy.
4. **Suggested order**: tops the position up to velocity × (lead + safety + **30 cycle days**), valued at average landed cost. Inbound POs are netted off first: **stock on the water is never re-ordered**.

## Using it

1. Rows sort by urgency: `Out of stock` → `Reorder now` → *Watch* (within a week of the trigger) → OK → No recent sales.
2. The **Raise the buys** card groups every suggested line by supplier: one click raises a pre-filled **draft PO** to review, adjust and place. The suggestion becomes a real document in seconds.
3. Integrators get the same numbers from `GET /api/v1/replenishment` (`?actionable` for just the SKUs needing action).

> **Tip:** Why the ledger matters here Because velocity reads the despatch ledger, a bundle sale drives replenishment of its *components*, and a retailer's pack-of-6 order counts as 6, the forecast can't drift from physical reality.
