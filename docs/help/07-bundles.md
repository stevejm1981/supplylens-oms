# Bundles & BOMs

> `/bundles`

A **bill of materials (BOM)** is the parts list that defines what a product is made of. One BOM concept powers two different product behaviours: **virtual bundles** (kitted at despatch, never on a shelf) and **assembled products** (manufactured ahead of orders through Production). This module is the full guide to setting BOMs up and how they flow into production orders.

## Step 1: choose the product type (this decides everything)

1. **Bundle (virtual)**: sold together, packed at the moment of despatch. Never holds stock; its availability is calculated live from components. Example: `BDL-BBQ-STARTER`.
2. **Assembled (manufactured)**: made in advance through a production order, then held and sold as real stock. Example: `HMW-HAMPER-01`, the Winter Hamper.
3. Rule of thumb: if someone glues, fills, brews, or boxes it *before an order exists*, it is assembled; if the picker gathers the parts *when an order ships*, it is a bundle.
4. Create the product on the Products page with the right type. Components themselves are always **standard** products, no bundles inside bundles, no assemblies inside assemblies.

## Step 2: build the BOM

1. Open `Bundles`, both bundles and assembled products are listed here, and click into the product.
2. Add component lines with the searchable picker and set each **quantity**, then `Save BOM`.
3. **For assembled products only: set the recipe yield.** "This recipe makes **N** units" tells the system the component quantities describe a *batch*, not a single unit. A hamper is per-unit (makes 1: one blanket, one candle set per hamper). A brew is per-batch (makes 1000: 35 tea, 20 sugar per 1000 bottles). Bundles are always per-unit.
4. Editing a BOM later never rewrites history, production orders snapshot their parts list when created, and completed builds keep what they actually used.

## Step 3: how the BOM flows into a production order

1. On `Production` → `New build`, choose the assembled product and a quantity. The parts list **fills itself**: component needed = BOM quantity × build quantity ÷ recipe yield.
2. With a recipe yield above 1 the dialog shows the batch maths ("recipe makes 1000, 2 batches"). Plan in **multiples of the yield** for exact numbers, partial batches round component needs **up**, better one part staged too many than a stalled line.
3. Each component shows a green or red dot against stock in the chosen warehouse before you commit, and short components can be bought via Replenishment or a PO first.
4. From there the production lifecycle takes over: Start consumes the parts, Finish records actuals, and the finished goods land in stock at their true rolled-up cost.

## How each type behaves day to day

1. **Bundle availability** is derived: the worst-case component (min over components of floor(stock ÷ per-unit quantity)). Channel feeds broadcast that number; despatch explodes to components; returns restock components. Two bundles sharing a component both count it, standard virtual-bundle behaviour.
2. **Assembled stock** is real: counted at stocktakes, transferable, adjustable, reservable, back-orderable, with cost tranches from each build (labelled with the BLD reference) feeding the same average-landed engine as PO receipts.

> **Tip:** Bulk setup Import BOMs at onboarding via the **bom-lines CSV on the Import/Export page (bundleSku, componentSku, quantity), with **recipeMakes set per assembled product in the products file.
