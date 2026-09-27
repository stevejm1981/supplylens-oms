# Production Orders

> `/production`

Make things. An **assembled** product (a third product type beside standard and virtual bundles) holds real stock and is built from its BOM through a three-moment document: **Plan**, **Start**, **Finish**. Built for basic operators: pick what to make, type one number, press the button, while the costing runs itself underneath.

## The operator's flow

1. `New build`: choose the assembled product (the demo has `HMW-HAMPER-01`, the Winter Hamper), type how many. The parts list fills itself from the BOM, honouring the recipe yield ("makes N per batch"), with a green or red dot per component, enough in stock or not, before anything is committed.
2. `Start build`: components leave stock in one transaction (ledger entries under the `BLD` reference) and their value moves into Work in Progress. The brew is in the tank.
3. `Finish build`: one question, "how many did you make?", pre-filled with the plan. Two optional extras behind collapsed toggles: adjust parts used (something broke, something was left over) and add build costs (labour, machine time) as one honest amount, no timesheets.

## What happens underneath

1. Extra parts consumed come out of stock; leftovers go back, both ledgered with a note.
2. Finished goods enter stock at **actual component value + build costs, divided by actual units made**, appearing as a cost tranche on the product (labelled with the build reference). Yield loss honestly raises the unit cost; the demo's clean 25-hamper run cost £17.71 each.
3. The accounting journal balances through Work in Progress and nets it to zero: components out, WIP in; finished stock in, WIP out, with build costs credited to Production Overhead Absorbed.
4. A completed build is a stock-in event, so back orders on the finished item clear themselves and holds activate, exactly like a PO receipt.

> **Tip:** Assembled vs bundle, when to use which A **bundle is kitted at the moment of despatch and never sits on a shelf. An **assembled product is made ahead of orders, counted at stocktakes, and sold like any physical SKU. Rule of thumb: if someone glues, fills, brews, or boxes it before an order exists, it is assembled.

> **Careful:** Deliberately not included Routings, work centres, labour timesheets, machine scheduling, and MRP. One honest build-cost number at completion covers the mid-market need without the enterprise swamp.
