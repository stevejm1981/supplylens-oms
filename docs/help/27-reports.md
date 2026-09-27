# Reports

> `/reports`

The starter sales dashboard: sales made in the last 30 days, net of credits, with margin measured against landed cost, not supplier price.

1. **Four KPIs**: Sales (net of credits: the card shows how much was credited), Orders (with average order value), **Margin @ landed cost** (£ and % of sales), and COGS @ landed cost.
2. **Top 5 products by sales**: revenue bars with units sold; instantly answers "what's actually selling?".
3. **Salesperson leaderboard**: ranked by revenue, each with order count and margin %. Friendly rivalry included.
4. **Sales by channel**: where the revenue actually came from: each integration channel vs manual/wholesale, with share of sales. Credits net off against the channel of their original order.
5. **Top customers**: orders, net sales, and share of the period's revenue.

> **Note:** Why the margin number is trustworthy Every figure traces back to the COGS snapshot taken at dispatch, which came from the landed-cost engine. Freight and duty are already in these margins, and credits net off correctly: a restocked return unwinds cost too, a write-off only unwinds revenue.
