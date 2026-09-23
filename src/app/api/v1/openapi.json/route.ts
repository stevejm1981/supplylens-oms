// The OpenAPI 3.1 description of the SupplyLens OMS API.
// Served unauthenticated so docs tooling can always load it; every operation
// itself requires the bearer key.

import { NextResponse } from "next/server";

const pence = (description: string) => ({
  type: "integer",
  description: `${description} (integer pence)`,
});

const spec = {
  openapi: "3.1.0",
  info: {
    title: "SupplyLens OMS API",
    version: "1.0.0-poc",
    description:
      "Order, stock and document API for the SupplyLens OMS prototype.\n\n" +
      "**Design**: everything resolves by human-stable codes, `customer.code`, `channel.code`, " +
      "`location.code`, product `sku`, so an integration (EDI, Mirakl, Shopify…) never needs " +
      "internal ids. All money is **integer pence**; all stock quantities are whole units.\n\n" +
      "**EDI POC recipe**: parse the inbound ORDERS/850 in SupplyLens Integrations, then POST it " +
      "here as one JSON body. Use the channel's own order number as `externalRef`, re-sends are " +
      "idempotent per (channel, externalRef). Poll `GET /sales-orders/{reference}` for status + " +
      "tracking to drive the ORDRSP/DESADV back, and push `GET /channels/{code}/feed` outbound.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }],
  components: {
    parameters: {
      updatedSince: {
        name: "updatedSince",
        in: "query",
        schema: { type: "string", format: "date-time" },
        description:
          "Incremental sync: only records modified after this instant. Every document carries `updatedAt` (auto-stamped on any change, including child-document activity like despatches touching their order). Poll with your last high-water mark.",
      },
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Per-integration tokens generated on the Integrations page (`oms_…`, shown once, SHA-256 at rest, revocable). The fixed development key `demo-key-supplylens` also works locally.",
      },
    },
    schemas: {
      IntakeLine: {
        type: "object",
        required: ["quantity", "unitPricePence"],
        description:
          "Identify the product by `sku` OR `barcode` (EAN/GTIN, what retailers actually send). sku wins if both are present. Barcodes are unique across the catalogue, so a match is never ambiguous. A barcode may also be an **outer/case GTIN** (GS1-style), which resolves the pack unit too: qty 16 against a pack-of-6 outer books 16 packs = 96 eaches from stock.",
        properties: {
          sku: { type: "string", example: "GRD-FIREPIT-01" },
          barcode: {
            type: "string",
            example: "5060871330011",
            description: "The product's own GTIN, or an outer/case GTIN (implies the pack unit)",
          },
          uom: {
            type: "string",
            example: "PACK6",
            description:
              "Pack unit code from the product's configurations. Omit for eaches; implied automatically by an outer barcode. quantity and unitPricePence are per this unit.",
          },
          quantity: { type: "integer", minimum: 1, description: "In the ordered unit (packs when a pack unit applies)" },
          unitPricePence: pence("Unit price as entered, per ordered unit"),
          discountPct: { type: "number", minimum: 0, maximum: 100, default: 0 },
        },
      },
      SalesOrderIntake: {
        type: "object",
        required: ["customer", "lines"],
        properties: {
          customer: { type: "string", description: "Customer code", example: "RANGE" },
          channel: {
            type: "string",
            description: "Channel code the order came through (omit for manual/wholesale)",
            example: "mirakl-tesco",
          },
          location: {
            type: "string",
            description:
              "Customer delivery-location code. Omitted → the customer's default location.",
            example: "AVONMOUTH-DC3",
          },
          customerPoNumber: { type: "string" },
          externalRef: {
            type: "string",
            description:
              "The channel's own order id. Idempotency key per (channel, externalRef): re-posting returns the existing order with `duplicate: true`.",
            example: "EDI-850-000123",
          },
          taxTreatment: {
            type: "string",
            enum: ["EXCLUSIVE", "INCLUSIVE", "NONE"],
            default: "EXCLUSIVE",
            description:
              "Xero-style: how the line prices were entered. INCLUSIVE extracts VAT from the prices.",
          },
          preOrder: {
            type: "boolean",
            default: false,
            description:
              "Secures the quantities: committed from creation, excluded from channel feeds, blocked from other despatches, including stock that arrives later.",
          },
          orderDate: { type: "string", format: "date" },
          requiredDate: { type: "string", format: "date" },
          shippingService: { type: "string", example: "DPD Next Day" },
          shippingInstructions: { type: "string" },
          giftMessage: { type: "string" },
          shippingPence: pence("Carriage charged to the customer"),
          notes: { type: "string" },
          lines: { type: "array", items: { $ref: "#/components/schemas/IntakeLine" }, minItems: 1 },
        },
      },
      IntakeResult: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          duplicate: {
            type: "boolean",
            description: "true when (channel, externalRef) already existed, no new order created",
          },
          reference: { type: "string", example: "SO-0016" },
          id: { type: "string" },
        },
      },
      AvailabilityItem: {
        type: "object",
        description:
          "Availability = onHand − committed − reserved. Channel feeds use `available`; bundles derive it from components (their raw fields are null).",
        properties: {
          sku: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["STANDARD", "BUNDLE"] },
          onHand: { type: ["integer", "null"] },
          committed: { type: ["integer", "null"] },
          preOrdered: { type: ["integer", "null"], description: "Subset of committed on pre-order flagged orders" },
          reserved: { type: ["integer", "null"] },
          onOrder: { type: ["integer", "null"], description: "Inbound on placed POs" },
          available: { type: "integer" },
        },
      },
      Error: {
        type: "object",
        properties: {
          ok: { type: "boolean", const: false },
          error: { type: "string" },
          errors: {
            type: "array",
            items: { type: "string" },
            description: "Every unresolved code/validation problem, so one fix pass suffices",
          },
        },
      },
    },
  },
  paths: {
    "/sales-orders": {
      get: {
        summary: "List sales orders",
        tags: ["Sales"],
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["DRAFT", "OPEN", "INVOICED"] } },
          { name: "channel", in: "query", schema: { type: "string" }, description: "Channel code" },
          { $ref: "#/components/parameters/updatedSince" },
        ],
        responses: { "200": { description: "Order summaries with fulfilment state and net value" } },
      },
      post: {
        summary: "Create a sales order (the EDI/marketplace intake)",
        tags: ["Sales"],
        description:
          "Resolves customer/channel/location/SKU codes, applies customer defaults (salesperson, warehouse, delivery location), and creates a DRAFT order. Idempotent per (channel, externalRef).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SalesOrderIntake" },
              example: {
                customer: "RANGE",
                channel: "mirakl-tesco",
                location: "AVONMOUTH-DC3",
                customerPoNumber: "TR-PO-EDI-850-000123",
                externalRef: "EDI-850-000123",
                taxTreatment: "EXCLUSIVE",
                shippingService: "Palletways Economy",
                shippingPence: 4500,
                lines: [
                  { sku: "GRD-PIZZA-STONE", quantity: 25, unitPricePence: 1499 },
                  { sku: "HMW-MUG-SET4", quantity: 40, unitPricePence: 1399, discountPct: 5 },
                ],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Order created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/IntakeResult" } } },
          },
          "200": { description: "Duplicate (channel, externalRef), existing order returned" },
          "422": {
            description: "Unresolved codes or invalid values, all problems listed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/sales-orders/{reference}": {
      get: {
        summary: "Order status readback (drives ORDRSP / shipment confirmations)",
        tags: ["Sales"],
        parameters: [
          { name: "reference", in: "path", required: true, schema: { type: "string" }, example: "SO-0016" },
        ],
        responses: {
          "200": {
            description:
              "Full order state: status, fulfilment, per-line despatched quantities, despatches with tracking numbers, invoice with due date",
          },
          "404": { description: "Unknown reference" },
        },
      },
      patch: {
        summary: "Partially update an order (merge semantics, no get-then-put)",
        tags: ["Sales"],
        description:
          "Only the fields you send change; explicit `null` clears a nullable field; everything omitted is retained. " +
          "`lines` merges **by SKU** (drafts only): patch `quantity`/`unitPricePence`/`discountPct` on a matching line, " +
          "`quantity: 0` removes it, an unseen SKU (with quantity + unitPricePence) adds one. " +
          "Setting `location` re-snapshots the delivery address unless you also send `deliveryAddress`. " +
          "After invoicing only logistics/reference fields may change, anything money-moving is refused with a named error. " +
          "Returns the full updated order, so no follow-up GET is needed.",
        parameters: [
          { name: "reference", in: "path", required: true, schema: { type: "string" }, example: "SO-0016" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", description: "Any subset of the intake fields plus line patches" },
              example: {
                shippingService: "DPD Next Day",
                customerPoNumber: "TR-PO-AMENDED-01",
                lines: [
                  { sku: "GRD-TONGS-01", quantity: 75 },
                  { sku: "GRD-CHRCL-5KG", quantity: 20, unitPricePence: 799 },
                ],
              },
            },
          },
        },
        responses: {
          "200": { description: "The full updated order" },
          "400": { description: "Empty patch or invalid JSON" },
          "404": { description: "Unknown reference" },
          "422": { description: "Blocked or invalid fields, all problems listed" },
        },
      },
    },
    "/stock": {
      get: {
        summary: "Availability across all products",
        tags: ["Inventory"],
        responses: {
          "200": {
            description: "SOH / committed / reserved / available per SKU",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    generatedAt: { type: "string", format: "date-time" },
                    items: { type: "array", items: { $ref: "#/components/schemas/AvailabilityItem" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/stock/movements": {
      get: {
        summary: "The append-only stock ledger",
        tags: ["Inventory"],
        parameters: [
          { name: "sku", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 200, maximum: 1000 } },
        ],
        responses: { "200": { description: "Events newest-first: signed qty, balance after, document ref" } },
      },
    },
    "/channels": {
      get: {
        summary: "Channels with their rule pipelines",
        tags: ["Channels"],
        responses: { "200": { description: "Channel codes, rules, order counts" } },
      },
    },
    "/channels/{code}/feed": {
      get: {
        summary: "A channel's stock feed (JSON)",
        tags: ["Channels"],
        description:
          "Runs the channel's rule pipeline over availability, the exact payload an integration should push out to the channel.",
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" }, example: "very" }],
        responses: { "200": { description: "Rows of sku / status (IS|OOS) / feed quantity" } },
      },
    },
    "/products": {
      get: {
        summary: "Product catalogue",
        tags: ["Catalogue"],
        responses: {
          "200": { description: "SKUs with family/variant, category, brand, costs, average landed cost, bundle BOMs" },
        },
      },
    },
    "/customers": {
      get: {
        summary: "Customers with named delivery locations",
        tags: ["Catalogue"],
        responses: {
          "200": { description: "Codes, defaults, payment terms, and location codes (the intake sync keys)" },
        },
      },
    },
    "/suppliers": {
      get: { summary: "Suppliers", tags: ["Catalogue"], responses: { "200": { description: "Supplier codes and lead times" } } },
    },
    "/warehouses": {
      get: { summary: "Warehouses", tags: ["Catalogue"], responses: { "200": { description: "Warehouse codes; one is default" } } },
    },
    "/purchase-orders": {
      get: {
        summary: "Purchase orders with landed-cost allocations",
        tags: ["Purchasing"],
        responses: { "200": { description: "POs with per-line allocated freight/duty/handling pence" } },
      },
    },
    "/despatches": {
      get: {
        summary: "Despatch documents (fulfilments)",
        tags: ["Sales"],
        responses: { "200": { description: "Per-line ordered → picked → despatched with tracking" } },
      },
    },
    "/invoices": {
      get: { summary: "Invoice register", tags: ["Finance"], responses: { "200": { description: "Net/VAT/gross with due dates" } } },
    },
    "/credit-notes": {
      get: {
        summary: "Credit notes",
        tags: ["Finance"],
        responses: { "200": { description: "Including which were auto-raised by customer returns" } },
      },
    },
    "/returns": {
      get: {
        summary: "Customer returns (RMA) and supplier returns (RTV)",
        tags: ["Sales"],
        responses: { "200": { description: "RMAs with restock/write-off triage; RTVs with expected credits" } },
      },
    },
    "/sales-orders/{reference}/despatches": {
      post: {
        summary: "Despatch confirmation (the WMS/3PL shipped goods)",
        tags: ["Fulfilment"],
        description:
          "One call runs the whole despatch lifecycle: creates the despatch document, deducts stock (bundles exploded, packs converted), consumes customer reservations, snapshots COGS at average landed cost, writes the movement ledger and the DESPATCH_COGS stock journal, and updates fulfilment state. Lines match order lines by sku/barcode (+optional uom); quantities are in the ordered unit and may be partial. Idempotent per (order, externalRef), DESADV re-sends return the existing despatch.",
        parameters: [
          { name: "reference", in: "path", required: true, schema: { type: "string" }, example: "SO-0017" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              example: {
                externalRef: "MINTSOFT-SHP-88123",
                shippingService: "DPD Next Day",
                trackingNumber: "15501999888",
                lines: [{ sku: "GRD-TONGS-01", uom: "PACK6", quantity: 16 }],
              },
            },
          },
        },
        responses: {
          "201": { description: "Despatched, returns the despatch reference and the full order readback" },
          "422": { description: "Unknown lines, over-confirmation, or stock shortage, nothing applied" },
        },
      },
    },
    "/purchase-orders/{reference}/receipts": {
      post: {
        summary: "Goods-in confirmation (warehouse received a placed PO)",
        tags: ["Fulfilment"],
        description:
          "Books the whole PO into stock in one transaction: levels move, PO_RECEIPT ledger entries are written, pending inbound reservation holds activate with zero gap, the PO_RECEIPT stock journal is written and the PO locks. Idempotent: re-receiving returns duplicate.",
        parameters: [
          { name: "reference", in: "path", required: true, schema: { type: "string" }, example: "PO-0003" },
        ],
        requestBody: {
          content: {
            "application/json": {
              example: { warehouse: "NTH" },
            },
          },
        },
        responses: {
          "201": { description: "Received into the given (or default) warehouse" },
          "422": { description: "PO is a draft, or the warehouse code is unknown" },
        },
      },
    },
    "/invoices/{number}/paid": {
      post: {
        summary: "Confirm an invoice as paid (accounting sync)",
        tags: ["Accounting"],
        description:
          "Sets the paid date, typically the Xero sync confirming money received. Idempotent. Optional body { \"paidAt\": \"2026-09-24\" } defaults to now. Invoice listings expose paidAt and a derived paymentStatus (UNPAID / OVERDUE / PAID).",
        parameters: [
          { name: "number", in: "path", required: true, schema: { type: "string" }, example: "INV-0012" },
        ],
        responses: { "200": { description: "Marked paid (duplicate: true if already paid)" } },
      },
    },
    "/stock-journals": {
      get: {
        summary: "Stock journals, the accounting outbox",
        tags: ["Accounting"],
        description:
          "Balanced Dr/Cr journals written in the same transaction as every stock event with a value consequence: DESPATCH_COGS (Dr Cost of Goods Sold / Cr Stock on Hand at average landed), PO_RECEIPT (Dr Stock / Cr Goods Received Not Invoiced), RETURN_RESTOCK + CREDIT_RESTOCK (Dr Stock / Cr COGS), ADJUSTMENT (Stock ↔ Stock Adjustments). The Xero loop: GET ?status=PENDING → create the journal in the accounting system → POST /stock-journals/{reference}/posted to acknowledge.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "POSTED"] } },
          { $ref: "#/components/parameters/updatedSince" },
        ],
        responses: { "200": { description: "Journals with debit/credit lines and posting state" } },
      },
    },
    "/stock-journals/{reference}/posted": {
      post: {
        summary: "Acknowledge a journal as posted to the accounting system",
        tags: ["Accounting"],
        parameters: [
          { name: "reference", in: "path", required: true, schema: { type: "string" }, example: "SJ-0014" },
        ],
        requestBody: {
          content: { "application/json": { example: { externalRef: "XERO-MJ-90211" } } },
        },
        responses: { "200": { description: "Marked POSTED (idempotent, re-acks return duplicate)" } },
      },
    },
    "/replenishment": {
      get: {
        summary: "Replenishment suggestions (forecasting)",
        tags: ["Inventory"],
        description:
          "Sales velocity from the despatch ledger (28-day window, base units), days of cover on Available, reorder point = velocity × (supplier lead time + 14 safety days), order-up-to adds a 30-day cycle. Suggestions already net off inbound POs. `?actionable` returns only SKUs with a suggested quantity.",
        parameters: [
          {
            name: "actionable",
            in: "query",
            schema: { type: "boolean" },
            description: "Only SKUs with suggestedOrderQty > 0",
          },
        ],
        responses: {
          "200": {
            description:
              "Per-SKU velocity, cover, status (OUT / REORDER / WATCH / OK / NO_SALES) and suggested order quantity + value",
          },
        },
      },
    },
    "/adjustments": {
      get: {
        summary: "Stock adjustments (stocktake variances, damage, shrinkage)",
        tags: ["Inventory"],
        parameters: [{ $ref: "#/components/parameters/updatedSince" }],
        responses: {
          "200": { description: "Adjustment documents with signed per-SKU deltas and reasons" },
        },
      },
    },
    "/transfers": {
      get: {
        summary: "Warehouse transfers",
        tags: ["Inventory"],
        parameters: [{ $ref: "#/components/parameters/updatedSince" }],
        responses: {
          "200": { description: "Transfer documents, from/to warehouse codes and per-SKU quantities" },
        },
      },
    },
    "/reservations": {
      get: {
        summary: "Stock reservations (holds, incl. inbound-PO holds)",
        tags: ["Inventory"],
        responses: { "200": { description: "Active/pending/released holds with customer + awaiting-PO links" } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}
