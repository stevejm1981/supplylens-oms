# The API & the EDI POC

> `/api-docs (Swagger UI) · spec at /api/v1/openapi.json · bearer key`

Every document type is exposed under `/api/v1`, described by an OpenAPI 3.1 spec with live try-it-out Swagger docs in the sidebar (**Developer → API Docs**). The design rule that makes integration trivial: **everything resolves by the codes the UI already manages**: customer code, channel code, location code, SKU: so an EDI or marketplace sync never touches an internal id.

## The intake: one POST per order

1. Authenticate with the bearer key (demo: `demo-key-supplylens`; set `OMS_API_KEY` to change it).
2. `POST /api/v1/sales-orders` with codes and integer-pence prices. Customer defaults do the rest: salesperson, warehouse and delivery location fill themselves, exactly as in the UI. Lines identify products by **SKU or barcode**: retailers send EAN/GTINs, and barcodes are unique in the catalogue so the match is never ambiguous. A barcode may also be an **outer/case GTIN**, which resolves the pack unit too: qty 16 against a pack-of-6 outer records 16 packs and moves 96 eaches through commitment, picking, despatch and returns. Quantities and prices on the line are always *per ordered unit* (per pack), so nothing gets divided and the pennies stay exact; an explicit `uom` code works with SKU lines too.
3. **Fulfilment flows back IN.** `POST /sales-orders/{ref}/despatches` is the WMS/3PL confirming goods shipped: one call creates the despatch, deducts stock, consumes reservations, snapshots COGS and writes the ledger + accounting journal: idempotent per shipment id, partials welcome. `POST /purchase-orders/{ref}/receipts` is goods-in: stock lands, inbound holds activate, the PO locks. Together they close the loop: retailer order in, the 3PL picks, confirmation in, everything moves itself.
4. **The accounting outbox.** Every stock event with a value writes a balanced Dr/Cr **stock journal** at average landed cost: despatch COGS (Dr Cost of Goods Sold / Cr Stock on Hand), PO receipts (Dr Stock / Cr GRNI), restocks, adjustments. Not a screen: a store an integration drains: `GET /stock-journals?status=PENDING` → post each to Xero → `POST /stock-journals/{ref}/posted` to acknowledge. The books see what stock *really* cost, and a journal can never exist without its physical cause (same transaction).
5. Send the channel's own order number as **externalRef**: intake is **idempotent per (channel, externalRef)**, so EDI re-sends and retries return the existing order (`duplicate: true`) instead of creating twins.
6. Bad codes come back as a **422 with every problem listed at once** ("unknown customer code, unknown SKU…"): one fix pass, not error whack-a-mole.
7. **Amend with PATCH**: the their previous inventory platform pain, fixed: send only the fields that changed and everything else is retained (explicit `null` clears; lines merge by SKU on drafts: quantity 0 short-cancels but retains the line). Quantity changes require an `amendmentReason` and are written to the order's amendment history with source "API"; originals are never overwritten. Money-moving fields refuse politely after invoicing. The response is the full updated order (including fill rates), so no follow-up GET.
8. **Sync incrementally**: every document carries `updatedAt`, auto-stamped on any change (child activity bumps the parent: a despatch going out touches its order). Every list endpoint takes `?updatedSince=` so a poller only ever pulls the delta.

```json
curl -X POST /api/v1/sales-orders \
  -H "Authorization: Bearer demo-key-supplylens" \
  -d '{ "customer": "RANGE", "channel": "mirakl-tesco",
        "location": "AVONMOUTH-DC3", "externalRef": "EDI-850-000123",
        "customerPoNumber": "TR-PO-EDI-850-000123", "shippingPence": 4500,
        "lines": [ { "sku": "GRD-PIZZA-STONE", "quantity": 25, "unitPricePence": 1499 } ] }'
# → { "ok": true, "duplicate": false, "reference": "SO-0016" }
```

## The full surface

| Endpoint | What it serves |
|---|---|
| `POST /sales-orders` | Order intake (idempotent), pre-order flag, tax treatment, discounts, delivery location all supported |
| `GET /sales-orders[/{ref}]` | Order list + full status readback: fulfilment, despatches with tracking, invoice, the ORDRSP/DESADV direction |
| `GET /stock` · `/stock/movements` | Availability breakdown (SOH/committed/reserved/available) and the audit ledger |
| `GET /channels[/{code}/feed]` | Rule pipelines, and each channel's ready-to-push feed as JSON |
| `GET /products · /customers · /suppliers · /warehouses` | The catalogue and code dictionaries an integration needs at setup |
| `GET /purchase-orders · /despatches · /invoices · /credit-notes · /returns · /reservations` | Every remaining document register, read-side |

## The EDI POC recipe

1. SupplyLens Integrations parses the inbound **ORDERS / 850** into its canonical document (already built in the platform).
2. A create-map turns that document into the intake JSON: trading partner → **customer code**, ship-to GLN → **location code**, the EDI order number → **externalRef**, lines by SKU. One POST.
3. Statuses flow back the other way: poll `GET /sales-orders/{ref}` for despatch tracking to build the **ORDRSP/DESADV**, and push `GET /channels/{code}/feed` as the stock update.

> **Careful:** POC boundaries One shared bearer key, read-side for most documents, no webhooks (poll for now) and no rate limiting, the production version gets per-integration keys, write endpoints for despatch/receipt confirmation, and event push.
