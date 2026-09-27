# Products

> `/products · /products/[id]`

The SKU catalogue. The list already answers the money question: base cost vs average landed cost, side by side, with the uplift percentage in amber.

## Three kinds of grouping: don't mix them up

| Axis | Question it answers | Example |
|---|---|---|
| Family | Which variants are the same product? | Chunky Knit Blanket → Grey / Navy / Ochre |
| Category | Where does it sit in the range? | Garden & Outdoor, Homeware, Packaging |
| Brand | Whose label is on it? | Ember & Oak, Hearth Home |

All three are created from the `New group ▾` menu and assigned on the product form. A product can carry any combination.

## Create a product

1. Click `+ New product`.
2. Fill in SKU and Name (required). Choose the **Type**: *Standard* is a physical SKU; *Bundle (virtual)* derives its stock from components: see the Bundles module.
3. Enter **Base cost (£)**, **Sell price (£)** and **Weight (g)**. Weight matters: it's the basis when a cost invoice allocates by weight.
4. Optionally set **Category** and **Brand**, and upload an **image** (PNG/JPEG/WebP/SVG up to 4 MB): it becomes the thumbnail in the list and the picture on the product page.
5. Click `Create product`.

> **Note:** Why weight matters A 12.4 kg fire pit soaks up far more of a freight bill than a 300 g pair of tongs. Skip weights and weight-based allocation falls back to an equal split, with a visible warning.

## Families & variants

1. Click `New family` to create a family, a parent grouping for colour/size/pack variants (e.g. *Chunky Knit Blanket*).
2. On each variant product, set its **Family** and a **Variant** label ("Grey", "75 cm"). Each variant stays a full SKU with its own stock, costs and barcode.
3. The list groups variants under a family header showing the variant count and combined stock; standalone products list normally below.
4. On any variant's detail page a **family bar** appears: click a sibling's pill to hop straight between variants.

## Read the list

1. Use the **search box** (filters live on SKU, name, family, variant, brand or category) plus the **category and brand dropdowns**: they combine.
2. Every row carries its **image thumbnail** (a generated initials tile until you upload a photo) with brand · category under the name.
3. **Avg landed** shows what the SKU really costs after freight and duty, with an amber `+x%` uplift over base cost.
4. **On hand** is total physical stock across all warehouses.
5. Click any SKU to open its detail page.

## The product detail page

1. **Edit anywhere**: the pencil icon on any row of the products list, or the `Edit product` button at the top of the product's detail page. Same form either way.
2. **Details card**: supplier, barcode, weight, base cost, sell price, and the headline average landed cost.
3. **Pack configurations card**: alternate selling units, GS1-style. Add a *Pack of 6* (code `PACK6`, 6 eaches) with its own **outer barcode**: the case GTIN retailers actually order against. Stock always stays in eaches; the pack is just a selling unit. A retailer ordering "qty 16" of the pack outer books 16 packs and commits 96 eaches: no rounding, no invalid pack increments.
4. **Stock by location**: one row per warehouse, with a total.
5. **Landed cost tranches**: the receipt-by-receipt breakdown of where the average comes from: opening stock at its opening cost, then every received PO line at its landed unit cost. The weighted average at the bottom is the number used everywhere else.
**Demo moment** Attach a new cost invoice to a received PO, come back here, refresh, the tranche re-prices and the average moves. Late freight bills just work.

> **Note:** Batch tracked products Tick **Batch tracked on a product (or set the `batchTracked` column on the products import) and goods in demands a lot reference per delivery, the product page gains a per-lot **Batches card, and despatch picking goes FEFO. The seeded drinks (`DRK-ELDER-750`, `DRK-GINGER-330`) show the whole loop.
