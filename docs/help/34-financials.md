# The Financials Map

> `GET /api/v1/stock-journals`

Every transaction that moves stock or money produces a financial artifact, written in the **same database transaction** as the physical event, so the books can never disagree with the warehouse. This table is the complete map: what happens in the OMS, what the ledger app receives, and where it lands in Xero.

| OMS transaction | Financial artifact | Journal (Dr / Cr) | In Xero |
|---|---|---|---|
| PO placed | none yet | no value has moved | optionally a Xero Purchase Order (informational, non-posting) |
| PO received | PO_RECEIPT journal + the GRN's bill payload | Stock on Hand / Goods Received Not Invoiced, at PO cost plus any freight already allocated | the journal posts as-is, and the integration raises a **DRAFT Bill** coded to GRNI from `GET /goods-receipts` (goods value and any pre-receipt landed share split out): the visible list of deliveries awaiting supplier invoices |
| Supplier invoice approved (three-way match) | GRN billed ack | no OMS journal: the ledger app posts the bill Dr GRNI / Cr Creditors, keeping the supplier off the ledger until the price matched | approve and post the draft Bill; `POST /goods-receipts/{ref}/billed` (or the Mark billed button) records it against the delivery |
| Cost invoice allocated (freight, duty) | LANDED_COST journal | Stock on Hand / Landed Costs Clearing (received portion; deletion writes the exact reversal) | the carrier's or HMRC's Bill coded to Landed Costs Clearing |
| Sales order despatched | DESPATCH_COGS journal | Cost of Goods Sold / Stock on Hand, at average landed | posts as a manual journal |
| Despatch with expected carriage | CARRIAGE_ACCRUAL journal | Cost to Serve / Carriage Accruals at the expected charge (revisions journal the delta) | manual journal; the accrual sits as a liability until the carrier bills |
| Carrier invoice matched | CARRIAGE_COST journal | variance only: Cost to Serve / Carriage Accruals, reversed when the charge came in under (deletion writes the exact reversal) | the carrier's Bill coded to Carriage Accruals, clearing it, the outbound mirror of GRNI |
| Sales order invoiced | Invoice document (net, VAT, gross, due date) | n/a, it IS the AR document | a Sales Invoice; Xero confirms payment back via POST /invoices/{n}/paid |
| Credit note (money only) | Credit document | none, revenue-side only | an AR Credit Note |
| Credit / customer return restock | CREDIT_RESTOCK / RETURN_RESTOCK journal + credit document | Stock on Hand / Cost of Goods Sold at despatch COGS | credit note + manual journal; write-offs stay in COGS deliberately |
| Supplier return sent (RTV) | SUPPLIER_RETURN journal | Supplier Credits Due / Stock on Hand at average landed | the supplier's credit note clears Supplier Credits Due |
| Stock adjustment | ADJUSTMENT journal | Stock on Hand ↔ Stock Adjustments at average landed | manual journal, adjustments account is P&L |
| Warehouse transfer | none | no value change, correctly silent | nothing |
| Production start | PRODUCTION journal | Work in Progress / Stock on Hand | manual journal |
| Production complete | PRODUCTION journal | Stock on Hand / WIP + Production Overhead Absorbed for build costs; WIP nets to zero per build | manual journal; overhead absorbed offsets wage costs |
| Opening stock import | OPENING journal | Stock on Hand / Opening Balances | maps to conversion-balance equity at cutover |
| Invoice paid | paidAt + status | n/a | flows FROM Xero into the OMS |

1. The sync loop: `GET /stock-journals?status=PENDING` → create each in the ledger app → `POST /stock-journals/{ref}/posted` with the ledger's id. Idempotent, so retries are safe.
2. Every journal is balanced by construction (the writer refuses unbalanced entries), and each is written inside the same transaction as its stock event.
3. Account names are fixed strings the sync maps once: Stock on Hand, GRNI, Landed Costs Clearing, COGS, Stock Adjustments, Work in Progress, Production Overhead Absorbed, Supplier Credits Due, Opening Balances, Cost to Serve, Carriage Accruals.

> **Tip:** PO or Bill in Xero? Both, at different moments. Placing an OMS purchase order can optionally raise a Xero PO (informational, no posting). The accounting happens at **receipt (goods onto the balance sheet against GRNI) and at the **supplier's bill (entered in Xero against GRNI, clearing it). Freight and duty bills clear Landed Costs Clearing the same way. Nothing is double-counted and stock value always reconciles: what goes on at receipt plus uplifts equals what COGS takes off.
