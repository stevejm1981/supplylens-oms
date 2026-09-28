# How do I…? The complete task index

> `Every job in the system, as a user would ask it`

Think of a thing you need to do, find the question, follow the steps. Every button name is verbatim from the screen. Each area links to its module section further down for the deeper explanation of what is happening underneath.

## Getting set up

### How do I sign in?

1. Open the app URL. You land on the sign-in page; enter your email and password and click `Sign in`. The demo login is `steve@supplylens.co.uk` / `demo1234`.
2. Buyers use a different door: the trade portal at `/portal` has its own sign-in, and a staff login will not work there (or vice versa), by design.

### How do I create an organisation from scratch?

1. On the sign-in page choose `Create one` (the sign-up link), enter your company name, your name, email, and a password, and click `Create organisation`.
2. You become the owner. Everything you now create (products, orders, settings) belongs to this organisation.

### How do I invite a colleague?

1. Go to `Settings`, find **Users & invitations**, type their email under **Invite someone**, pick a role (Member or Admin), and click `Create invite`.
2. Copy the invite link that appears and send it to them yourself (invites are shareable links, you deliver them). The link works once and expires after seven days; re-inviting the same address refreshes it.
3. They open the link, set their name and password, and land signed in as part of your organisation.

### How do I add a warehouse?

1. `Warehouses` (Inventory group) → `New warehouse` → name and short code (e.g. NTH). Tick default if orders and receipts should pre-select it.

### How do I load all my data in one go?

1. `Import / Export` (Admin group). Export any register first: the file that comes out IS the import template, so the columns can never be wrong.
2. Fill the CSVs and import them in the numbered order shown (salespeople → warehouses → suppliers → customers → locations → products → packs → BOM lines → opening stock → price lists), because later files reference earlier ones by code.
3. Any error anywhere rejects the whole file with row-numbered messages, fix and re-import. Re-importing is always safe: rows update by their code or SKU, and blank cells leave existing values alone.
4. No data of your own yet? Use the **demo import pack** on the same page, nine ready-made files that build a small self-contained range.

## Products and catalogue

### How do I add a new product?

1. `Products` → `New product`. SKU and name are required; set the type: **Standard** (bought in), **Assembled** (you make it), or **Bundle** (virtual kit).
2. Add the barcode (EAN/GTIN), weight in grams (drives weight-based freight splits), base cost, and sell price. Pick the supplier so replenishment knows who to buy it from.
3. Tick **Batch tracked** if every delivery must record a lot and best-before (food and drink). Click `Create product`.
4. To change anything later, open the product and click `Edit product`, or use the pencil on the register row.

### How do I sell a product in packs or cases?

1. Open the product → **Pack configurations** card → `Add pack`: code (PACK6), name, units per pack, and the outer/case barcode (GTIN-14).
2. Order forms then offer the pack as a unit (price scales automatically), retailers can order by the outer barcode through the API, and stock still counts in single units underneath.

### How do I group colour or size variants together?

1. On `Products`, use `New group ▾` to create a family (e.g. Chunky Knit Blanket), then edit each variant product and set its family and variant label (Grey, Ochre).
2. The register groups them, and every variant's page shows a pill bar to hop between siblings.

### How do I create a bundle (a kit I sell but never build)?

1. `Bundles & BOMs` → `New bundle` → give it a SKU, name, and sell price.
2. Open it and add component lines (product and quantity), then `Save BOM`.
3. That is all: availability derives from the components, ordering one puts the components on the pick list, and despatching moves component stock. There is nothing to assemble and no bundle stock to manage.

### How do I set up a product I manufacture?

1. Create the product with type **Assembled**, then open it in `Bundles & BOMs` and add its component lines.
2. Set **This recipe makes [N]** if the component quantities describe a batch (35 tea and 20 sugar make 1000 bottles). Leave it at 1 for per-unit recipes.
3. Stock of an assembled product is created by production orders, see [Making stock](#how-make) below.

## Buying and goods in

### How do I add a supplier?

1. `Suppliers` → `New supplier`: name, short code, country, contact, and crucially the **lead time in days**, replenishment uses it to work out when to reorder.

### How do I raise a purchase order?

1. `Purchase Orders` → `New purchase order`.
2. Choose the supplier. If this order shares a shipping container with another PO, type the same **Container ref** on both, that is how one freight bill later splits across them.
3. Add lines: pick each product (type to search), quantity, and unit cost (pre-filled from the product, override with the quoted price). Click `Create purchase order`.
4. It lands as a `Draft`. When the supplier confirms, open it and click `Place order`. Placed stock shows as "on order" in availability and replenishment.

### How do I book a delivery in?

1. `Goods-In Station` (Warehouse group). Every placed or part-received PO waits in the queue with what is still outstanding; click `Receive` on the delivery's order.
2. Check the warehouse selector (top right) is where the goods are landing.
3. Each line pre-fills with the outstanding quantity, so a complete delivery needs no typing. Short delivery? Edit the arrived number. Scan or type a barcode and Enter to jump to a line; a barcode not on the order is refused.
4. Batch-tracked products show two extra boxes: the lot reference (required) and best-before date. Type them from the label at the door.
5. Click `Receive delivery`. Stock lands, a goods receipt document (GRN) records exactly this delivery, and the PO moves to `Part received` or `Received` on its own. The rest of the order stays in the queue for the next van.

### How do I receive a whole PO in one click instead?

1. Open the purchase order and click `Receive all outstanding`, pick the warehouse, and confirm with `Receive into stock`. Use the Goods-In Station when quantities differ or batches need recording.

### How do I add freight or duty costs to my stock value?

1. `Cost Invoices` → `New cost invoice`. Enter the bill's reference, the vendor, its type (Freight, Duty, Insurance, Handling), and the amount.
2. Tick the purchase orders it covers and choose the split basis: by value, by quantity, or by weight. Click `Save & allocate`.
3. The amount spreads across every line penny-exactly and each product's average landed cost re-prices immediately, even if the goods were received weeks ago. Open any product to see the tranche-by-tranche cost story.

### How do I know what to reorder?

1. `Replenishment`. Every product shows its real sales velocity (from what actually despatched), days of cover, and status: **OUT**, **REORDER**, **WATCH**, or **OK**.
2. Suggested quantities already subtract stock on order, so goods on the water are never bought twice.
3. Tick the rows you agree with and click `Raise the buys`: one draft PO per supplier appears, ready to review and place.

## Stock

### What do the stock columns actually mean?

1. **On hand** is physically on the shelf. **Committed** is promised to open orders (bundles counted as their components, packs as units). **Reserved** is ring-fenced by a hold. **Available** = on hand minus committed minus reserved: what you can still sell. Red negative available = oversold.

### How do I add stock without a purchase order?

1. Going live? Use the **opening stock** import on `Import / Export`: quantity, warehouse, and unit cost per SKU, once per product.
2. Day to day (found stock, samples, corrections): `Adjustments` → `New stock adjustment`, choose the warehouse, add a line with a positive quantity, give the reason, and `Apply adjustment`.

### How do I correct stock after a count?

1. `Adjustments` → `New stock adjustment`: one document, plus and minus lines for everything the count disagreed with, a mandatory reason (e.g. "Stocktake variance, aisle C"), then `Apply adjustment`. It applies instantly and every line is on the movement ledger.

### How do I move stock between warehouses?

1. `Transfers` → `New warehouse transfer`: from, to, lines, done. The ledger records the out and the in under the same TRF reference.

### How do I hold stock back for a customer or a launch?

1. `Reservations` → `Reserve stock`: product, quantity, warehouse, and optionally the customer it is held for.
2. Held for a customer, their despatches use it automatically and the hold releases itself, the pre-order mechanism. Held generally, it blocks everyone until you release it.
3. Stock still on a placed PO? Reserve against the PO and the hold activates the moment the goods are received, with no window for a channel to sell into.

### How do I trace what happened to a product's stock?

1. Open the product and read its movement trail, or go to `Movements` and filter. Every receipt, despatch, adjustment, transfer, return, and build is there with the document that caused it and the balance after. This history cannot be edited.

### How do I see and trace batches?

1. A batch-tracked product's page has a **Batches** card: each lot's on-hand by warehouse, best-before, in the order picking will use them (earliest best-before first).
2. Recall question ("which orders got lot X?"): filter `Movements` to the product, the despatch rows name the lot they consumed and the order they went to.

## Making stock (production)

### How do I build an assembled product?

1. `Production Orders` → `Plan a build`: what you are making, how many, and where. The parts list fills itself from the recipe with a green or red dot per component, enough or not, before anything commits. Click `Plan build`.
2. When the line starts, click `Start build`: components leave stock into the build.
3. When it ends, click `Finish build` and answer one big question: how many did you actually make? Open "adjust parts" if consumption differed from plan, and "add build costs" to absorb labour or machine time.
4. Finished goods land in stock at their true rolled-up cost (parts plus build costs divided by what you really made), and every movement is on the ledger.

## Selling

### How do I add a customer?

1. `Customers` → `New customer`: name, code, default salesperson, default warehouse, and **payment terms in days** (drives invoice due dates and how the portal treats their orders).
2. Use the map-pin icon on the row to add named delivery locations (each with a code your integrations can send).
3. Special prices? The pound icon opens their **price list**: per-product prices that pre-fill orders, the portal, and API orders. Portal access? The person icon invites their buyers.

### How do I add a new sales order?

1. `Sales Orders` → `New sales order`.
2. Pick the **customer first**: salesperson, warehouse, delivery address, and prices all pre-fill from their record (change any of them freely). Pick a named delivery location if they have several.
3. Add lines: type to search the product, choose the unit (each, or a pack size, the price scales), set quantity, and a discount % if agreed. Prices come from the customer's price list when one exists, else the sell price.
4. Add what the order needs: their PO number, required date, carriage charged (Shipping £), VAT treatment (prices entered ex-VAT, inc-VAT, or no VAT), delivery instructions, or a gift message. Tick pre-order to secure stock for it.
5. **The warehouse dropdown decides where the order fulfils from**: it opens on your default and switches to the customer's default when you pick them. After creation, `Change warehouse` on the order moves it (stock held for the order follows) until anything ships; once a despatch exists it is fixed. API orders take an optional `warehouse` code at intake and can re-route via PATCH under the same rule.
6. Click `Create sales order`. It lands as a `Draft`, which means held for review: quantities can still be amended honestly, and the warehouse queue does not despatch drafts you are still checking. Not enough stock? The order page shows a back-order card, see the next question.

### How do I tag orders and lines?

1. Tags are free text labels ("gift-wrap", "priority", "fragile"), display only, nothing ever behaves differently because of one.
2. Channel orders bring their own: the API intake accepts `tags` on the order and on each line, so whatever the marketplace sends rides along untouched.
3. By hand: the new-order form has a **Tags** field (comma separated) at order level.
4. They show as chips on the order page, the Despatch Station queue and lines, and the printed pick list, so "FRAGILE" reaches the person actually packing the box.

### The customer ordered more than I have. Now what?

1. Open the order: an amber **Back order** card lists exactly what is short and who supplies it. Click `Cover shortfall, raise PO`: one draft PO per supplier is raised for the shortfall and linked to this order both ways.
2. Stock arriving on that PO is held for this customer automatically, and the back-order state clears itself the moment stock covers it. Nothing to manage by hand.

### How do I change quantities on a held order?

1. On a draft order click `Amend confirmed quantities`, change the numbers (0 short-cancels a line but keeps it visible), give the reason, and `Save amendments`.
2. The customer's original quantities are kept forever next to what you confirmed, and the fill-rate figures on the order and in Reports use both.

### How do I despatch an order from the office?

1. On the order click `Create despatch` and set the quantities shipping now (part-shipments are fine, the rest stays outstanding).
2. Click `Confirm picked` once the warehouse confirms the pick.
3. Click `Despatch`: enter the shipping service, tracking number, and the **carriage cost** you expect the carrier to charge you (optional but powers true margin). Stock deducts, costs snapshot, tracking is on the order.

### How does the warehouse despatch without the office?

1. `Despatch Station`: the packing bench queue. Click `Start picking` on the next order (or tick several and `Print job list` for one consolidated shelf walk first).
2. `Print pick list` for the paper that walks the shelves, then scan each item at the bench to verify, wrong items and extras are refused on the spot. Short-pick if the shelf is short; the balance re-queues.
3. Pack: parcels, weight (pre-filled from the catalogue), service, and the expected carriage cost. Generate the label and `Confirm despatch`. Everything downstream (stock, costs, order status, journal) happens in that click.

### How do I invoice an order and record payment?

1. On a fully despatched order click `Create invoice`: net, VAT, and the due date from the customer's terms are computed for you.
2. Short shipped and the balance is never coming? Click `Invoice despatched` instead: the invoice bills exactly what shipped, each short line's confirmed quantity is amended down to its despatched quantity (audited, the customer's originals are kept for fill rates), and the undespatched balance stops queueing.
3. When the money arrives, `Invoices` → `Mark paid`. Overdue flags itself from the due date; in production your ledger app confirms payments back automatically through the API.

### How do I credit a customer?

1. Goods coming back? Book a return instead (next question), the credit raises itself.
2. Money-only gesture (price adjustment, goodwill): on the invoiced order click `Create credit note`, set quantities and prices, leave restock unticked, and `Raise credit note`.

### How do I handle a customer return?

1. On the order click `Book customer return` and set the quantities coming back (capped at what actually shipped). An RMA is created, awaiting the goods.
2. When the parcel arrives, open it under `Returns` and decide per line: restock (sellable, goes back into stock) or write off (damaged). Click `Receive & credit`.
3. The credit note raises itself, restocked goods return to stock with their cost reversed, and write-offs stay honestly in cost of sales.

### How do I send faulty stock back to a supplier?

1. `Returns` → `New supplier return`: supplier, warehouse, lines, and the credit you expect. `Create return`, then send it: stock leaves, and the expected credit is tracked until their credit note arrives.

### Where do I see what an order really earned?

1. Open the order's **Totals** card: net revenue, COGS at average landed cost, **Margin**, then **Cost to serve** (the carriage) and **True margin**, what is left after the carrier is paid. Line-level margins sit on each row.

## Carrier bills and the money side

### How do I record what the carrier charges me?

1. At despatch (office dialog or the station's pack step) enter the expected **Carriage cost**. That accrues it against the order immediately.
2. When the carrier's weekly bill arrives: `Carrier Invoices` → `New carrier invoice`. Enter their invoice number and carrier, one line per consignment, and tick the despatches each line covered (search by order, tracking, or customer).
3. One consignment carrying several orders? Choose the split: by order value, by weight, equally, or manual amounts. Click `Create and match`.
4. Every order now shows invoiced carriage instead of the estimate, the variance is visible per consignment, and true margin updates. In your ledger app, code the carrier's bill to **Carriage Accruals**.

### How does all of this reach my accounts?

1. Every stock event with a value consequence writes a balanced journal into an outbox as it happens: receipts, despatch COGS, adjustments, returns, production, landed costs, carriage. Nothing to prepare at month end.
2. The sync (or you) drains it: `GET /api/v1/stock-journals?status=PENDING`, post to the ledger app, acknowledge back. The [Financials Map](./34-financials.md) section shows the exact Dr/Cr and Xero treatment for every transaction type.

## Channels and the trade portal

### How do I control the stock figures each channel sees?

1. `Channels` → `New channel` (the code is the integration's sync key), then open it and stack rules: hold back a buffer, divide, subtract, blank when out.
2. The preview recalculates against live availability as you edit; `Save rules` and the channel's CSV feed follows. Reserved and committed stock is already excluded before rules run.

### How do I give a customer a login to order online?

1. `Customers` → person icon on their row → type the buyer's email → `Invite` → copy the link to them.
2. They set a password and get the trade portal: the catalogue at THEIR prices with live stock bands, a basket that orders straight into your OMS, order tracking, invoices with amounts owing, and return requests that arrive as RMAs.
3. Terms decide payment: a customer on 30 days orders on account; a zero-terms customer's orders land flagged proforma, awaiting payment before despatch.

## Admin and integration

### How do I print a document?

1. Every document has a `Print` button (the printer icon): the sales order and purchase order on their detail pages, invoices and credit notes on their registers, despatch notes on the Despatches register and the order's shipments card, GRNs on the purchase order's Deliveries card, and RMAs/RTVs on the Returns page.
2. The document opens in a new tab on shared letterhead (your organisation's name, structured address, and VAT number from Settings) and the print dialog opens itself. Pick lists and job lists print from the Despatch Station as before.
3. What prints is the record as booked: invoice and credit totals come from the stored document (penny-exact), despatch notes carry no prices (they travel with the goods), and the GRN shows what actually arrived, batches included.

### How do I rename statuses or change document numbering?

1. `Settings`: set a prefix per document type (new documents only, existing references never change) and rename any status label. Labels are display-only, so "Held order" can replace "Draft" without any integration noticing.

### How do I connect another system?

1. `Integrations` → `Generate token`, name it after the system, and copy the token: it is shown once. One token per integration, so each can be revoked alone.
2. Point the system at `/api/v1` with that token. Orders in, stock and feeds out, despatch and receipt confirmations, invoices, journals: the whole surface is documented under `API Docs`, where you can try any call live.

> **Tip:** Can't find your question? Every module section below carries the deeper explanation and its own walkthrough, and the [Testing Playbook](./38-testing.md) doubles as a checklist of everything the system can do. If a job you need is genuinely missing, that is roadmap feedback, exactly what this guide is for.
