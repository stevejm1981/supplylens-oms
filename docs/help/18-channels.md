# Channels

> `/channels · /channels/[id] · /channels/[id]/feed`

A channel is the trading connection an integration represents: one identity, two directions: **orders sync in** from it (tagged on the sales order), **stock feeds flow out** to it (the rules pipeline). Feeds run on **Available** (on hand − committed − reserved), so pre-sold and reserved stock never reaches a channel.

> **Note:** The concept The channel **code is the join key to the SupplyLens integration it represents, `mirakl-tesco`, `very`, `frasers`. In production, an order synced from Mirakl - Tesco arrives already stamped with that channel; in the prototype you pick it on the sales order to simulate the sync. Manual and wholesale orders simply carry no channel.

## Create a channel

1. Click `+ New channel`, give it a Name (*Mirakl Tesco*) and a code matching the integration (*mirakl-tesco*, also used in the feed filename), and you land straight in the rule builder. The channel list shows how many sales orders each channel has brought in.

## Build the rule pipeline

1. Pick a step type from the dropdown and click `+ Add step`. Five types exist, see the table.
2. Set each step's numbers inline. Reorder with the ↑↓ arrows: **order changes meaning**: each step reads the quantity as it stands at that point in the pipeline.
3. Watch the **Live preview**: every SKU with raw quantity, `In stock`/`Out of stock` status, and the final feed quantity (or *blank*).
4. Tick or untick **Include bundles in this feed**: bundles flow through at their derived availability.
5. Click `Save rules`. The preview is live-as-you-edit, but the downloadable feed only uses *saved* rules.
6. Click `Download feed (CSV)` for the actual file: `SKU,Status,Quantity`, blank quantity when the rules say blank.

| Step | What it does |
|---|---|
| Out-of-stock threshold | Status = OOS when qty ≤ N at this point in the pipeline, else IS |
| Subtract buffer | qty − N (the classic “hold back 20”) |
| Divide quantity | qty ÷ N with floor / ceil / nearest rounding |
| Clamp min/max | Pin qty into a range, e.g. never above 50 |
| Blank when OOS | Send an empty quantity cell for OOS SKUs (Very requires this) |

> **Note:** Order matters, the Very case Very's pipeline is: ① threshold 5 → ② divide by 4 (floor) → ③ blank when OOS. The threshold sits *before* the divide, so it tests the *raw* quantity: 8 in stock → IS with feed qty 2. Move the threshold after the divide and the same SKU goes OOS. The preview makes the difference obvious, try it.

> **Note:** Safety rails Whatever the pipeline says, feed quantities are always floored to whole units and never negative, a missing clamp step can't send −12 to a retailer.

Seeded examples to study: **Very** (threshold 5, ÷4, blank), **Frasers Group** (−20, clamp 0), **John Lewis** (−10, clamp 0 to 50), **Costco** (threshold 10, ÷2, blank).
