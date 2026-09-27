# Import / Export

> `/data`

Customer onboarding in CSVs. Every register has an **Export** (which doubles as the import template: same columns, guaranteed in sync), a blank **Template**, and an **Import**. The page documents the full column mapping for every entity: column → field, required or optional, and the rules.

## The demo import pack (no data authoring needed)

1. The Import/Export page offers a **9-file demo pack**, the "Coastal" range: 1 salesperson, 1 warehouse (DEMO), 1 supplier, 1 customer with 2 locations, 6 products (4 standard with barcodes, 1 bundle, 1 assembled with a makes-10 recipe), 1 outer-barcode pack, 5 BOM lines, and ~£2,105 of opening stock with its take-on journal.
2. Download and import in number order. Everything lands **alongside** the seeded story under its own codes; nothing existing is touched; reseeding removes it all. Re-imports are safe except opening stock, which correctly loads once.
3. Then run the lifecycle on data YOU imported: order diffusers by case barcode `5060871330555`, build 20 candle boxes (2 batches), despatch a gift set and watch the bundle explode.

## The onboarding flow

1. Work down the page **in the numbered order**: later files reference earlier ones by code: *Salespeople → Warehouses → Suppliers → Customers → Delivery locations → Products → Pack configurations → Bundle BOMs → Opening stock*.
2. For each entity, download the `Template` (or an `Export CSV` from a system that already has data), fill it in, and `Import` it back.
3. Read the result: *N created, M updated*, or a row-numbered list of every problem in the file.

## The three guarantees

1. **All-or-nothing.** Every row is validated before anything is written; one bad row rejects the whole file with all its problems listed. A half-imported catalogue cannot exist.
2. **Idempotent.** Rows upsert by their natural key (code / SKU / name): re-importing a file is safe, and *export → edit in Excel → import* is the supported bulk-edit workflow.
3. **PATCH semantics.** On updates, a blank cell means "leave unchanged": you only overwrite what you fill in, the same philosophy as the API's PATCH.

> **Tip:** Friction removed where it's safe Families, categories and brands auto-create from their codes during a product import, and an unknown salesperson name on a customer auto-creates too. Suppliers and warehouses must exist first, those carry real data you should set up deliberately.

> **Careful:** Opening stock loads once Initial balances (with landed unit cost, feeding the average-cost engine and an *Opening balance* ledger entry) can only be imported for a product/warehouse with no stock history. After go-live, corrections go through Adjustments, that's what keeps the ledger honest.
