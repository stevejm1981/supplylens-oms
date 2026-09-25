// Seed: one container (MSCU-4821907) carrying two received POs, three cost
// invoices spread across them via the REAL allocator (dogfooding the engine),
// a draft PO for the live receive demo, bundles, and four channels with the
// rules discussed with the customer (Very ≤5→OOS ÷4, Frasers −20, etc.).

import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { hashPassword } from "../src/lib/auth-crypto";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { allocateInvoice, type AllocationMethod } from "../src/lib/engine/landed-cost";
import type { RuleStep } from "../src/lib/engine/channel-rules";
import { orderTotalsPence } from "../src/lib/sales";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

const gbp = (pounds: number) => Math.round(pounds * 100);
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function wipe() {
  await db.portalSession.deleteMany();
  await db.portalInvitation.deleteMany();
  await db.portalUser.deleteMany();
  await db.customerPrice.deleteMany();
  await db.session.deleteMany();
  await db.invitation.deleteMany();
  await db.membership.deleteMany();
  await db.user.deleteMany();
  await db.organisation.deleteMany();
  await db.orderAmendment.deleteMany();
  await db.stockReservation.deleteMany();
  await db.productionOrderLine.deleteMany();
  await db.productionOrder.deleteMany();
  await db.stockJournalLine.deleteMany();
  await db.stockJournal.deleteMany();
  await db.stockAdjustmentLine.deleteMany();
  await db.stockAdjustment.deleteMany();
  await db.warehouseTransferLine.deleteMany();
  await db.warehouseTransfer.deleteMany();
  await db.stockMovement.deleteMany();
  await db.customerReturnLine.deleteMany();
  await db.customerReturn.deleteMany();
  await db.supplierReturnLine.deleteMany();
  await db.supplierReturn.deleteMany();
  await db.customerLocation.deleteMany();
  await db.despatchLine.deleteMany();
  await db.despatch.deleteMany();
  await db.creditNoteLine.deleteMany();
  await db.creditNote.deleteMany();
  await db.invoice.deleteMany();
  await db.salesOrderLine.deleteMany();
  await db.salesOrder.deleteMany();
  await db.customer.deleteMany();
  await db.salesPerson.deleteMany();
  await db.costAllocation.deleteMany();
  await db.costInvoicePurchaseOrder.deleteMany();
  await db.costInvoice.deleteMany();
  await db.purchaseOrderLine.deleteMany();
  await db.purchaseOrder.deleteMany();
  await db.stockLevel.deleteMany();
  await db.warehouse.deleteMany();
  await db.bomLine.deleteMany();
  await db.product.deleteMany();
  await db.productFamily.deleteMany();
  await db.category.deleteMany();
  await db.brand.deleteMany();
  await db.supplier.deleteMany();
  await db.channel.deleteMany();
}

// Ledger entry, call AFTER the stock mutation so balanceAfter is correct.
async function logMove(
  productId: string,
  warehouseId: string,
  quantity: number,
  type: string,
  reference: string,
  referenceId: string | null,
  when: Date,
) {
  const level = await db.stockLevel.findUnique({
    where: { productId_warehouseId: { productId, warehouseId } },
  });
  await db.stockMovement.create({
    data: {
      productId,
      warehouseId,
      quantity,
      balanceAfter: level?.quantity ?? 0,
      type,
      reference,
      referenceId,
      createdAt: when,
    },
  });
}

async function main() {
  await wipe();

  // ── Warehouses ───────────────────────────────────────────────────────────
  const northampton = await db.warehouse.create({
    data: { name: "Northampton DC", code: "NTH", isDefault: true },
  });
  const leeds = await db.warehouse.create({
    data: { name: "3PL Leeds", code: "LDS" },
  });

  // ── Demo organisation & owner ─────────────────────────────────────────────
  await db.user.create({
    data: {
      email: "steve@supplylens.co.uk",
      name: "Steve Martin",
      passwordHash: hashPassword("demo1234"),
      memberships: {
        create: {
          role: "OWNER",
          org: {
            create: {
              name: "Greenfield Trading Co.",
              vatNumber: "GB123456789",
              address: "Unit 4, Meadow Business Park\nNorthampton NN4 7XD",
            },
          },
        },
      },
    },
  });

  // ── Suppliers ────────────────────────────────────────────────────────────
  const [sbt, yiwu, midlands] = await Promise.all([
    db.supplier.create({
      data: {
        name: "Shenzhen Bright Trading Co.",
        code: "SBT",
        country: "CN",
        contactEmail: "sales@sbt-trading.cn",
        leadTimeDays: 45,
      },
    }),
    db.supplier.create({
      data: {
        name: "Yiwu Homeware Mfg",
        code: "YHM",
        country: "CN",
        contactEmail: "export@yiwuhomeware.cn",
        leadTimeDays: 40,
      },
    }),
    db.supplier.create({
      data: {
        name: "Midlands Packaging Ltd",
        code: "MPL",
        country: "GB",
        contactEmail: "orders@midlandspkg.co.uk",
        leadTimeDays: 7,
      },
    }),
  ]);

  // ── Products ─────────────────────────────────────────────────────────────
  const productData = [
    // Shenzhen Bright Trading
    { sku: "GRD-FIREPIT-01", name: "Steel Fire Pit 60cm", weightGrams: 12400, baseCost: 38.5, sell: 89.99, supplierId: sbt.id, barcode: "5060871330011" },
    { sku: "GRD-TONGS-01", name: "BBQ Tongs 40cm", weightGrams: 300, baseCost: 1.85, sell: 7.99, supplierId: sbt.id, barcode: "5060871330028" },
    { sku: "GRD-CHRCL-5KG", name: "Charcoal Briquettes 5kg", weightGrams: 5000, baseCost: 3.2, sell: 9.99, supplierId: sbt.id, barcode: "5060871330035" },
    { sku: "GRD-PIZZA-STONE", name: "Pizza Stone 33cm", weightGrams: 1900, baseCost: 4.1, sell: 19.99, supplierId: sbt.id, barcode: "5060871330042" },
    // Yiwu Homeware
    { sku: "HMW-BLANKET-GRY", name: "Chunky Knit Blanket Grey", weightGrams: 1800, baseCost: 8.9, sell: 34.99, supplierId: yiwu.id, barcode: "5060871330059" },
    { sku: "HMW-CANDLE-3PK", name: "Scented Candle 3-Pack", weightGrams: 950, baseCost: 2.6, sell: 14.99, supplierId: yiwu.id, barcode: "5060871330066" },
    { sku: "HMW-MUG-SET4", name: "Stoneware Mug Set of 4", weightGrams: 1600, baseCost: 3.75, sell: 18.99, supplierId: yiwu.id, barcode: "5060871330073" },
    { sku: "HMW-LANTERN-01", name: "Glass Lantern Small", weightGrams: 700, baseCost: 2.95, sell: 12.99, supplierId: yiwu.id, barcode: "5060871330080" },
    // Midlands Packaging
    { sku: "PKG-GIFTBOX-L", name: "Gift Box Large", weightGrams: 250, baseCost: 0.85, sell: 2.99, supplierId: midlands.id, barcode: "5060871330097" },
    { sku: "PKG-TISSUE-50", name: "Tissue Paper 50 Sheets", weightGrams: 400, baseCost: 1.1, sell: 3.49, supplierId: midlands.id, barcode: "5060871330103" },
  ] as const;

  const products = new Map<string, { id: string }>();
  for (const p of productData) {
    const created = await db.product.create({
      data: {
        sku: p.sku,
        name: p.name,
        barcode: p.barcode,
        weightGrams: p.weightGrams,
        baseCostPence: gbp(p.baseCost),
        sellPricePence: gbp(p.sell),
        supplierId: p.supplierId,
        type: "STANDARD",
      },
    });
    products.set(p.sku, created);
  }
  const pid = (sku: string) => products.get(sku)!.id;

  // ── Pack configurations (alternate selling units) ────────────────────────
  // GS1-style: the outer/case has its own GTIN. Retailers order "16" of the
  // pack barcode and the OMS converts to eaches everywhere stock moves.
  await db.productUom.createMany({
    data: [
      {
        productId: pid("GRD-TONGS-01"),
        code: "PACK6",
        name: "Pack of 6",
        unitsPerUom: 6,
        barcode: "5060871330288",
      },
      {
        productId: pid("GRD-CHRCL-5KG"),
        code: "CASE4",
        name: "Case of 4",
        unitsPerUom: 4,
        barcode: "5060871330295",
      },
      {
        productId: pid("HMW-CANDLE-3PK"),
        code: "CASE12",
        name: "Case of 12",
        unitsPerUom: 12,
        barcode: "5060871330301",
      },
    ],
  });

  // ── Assembled product: the Winter Hamper (manufactured, holds stock) ─────
  const hamper = await db.product.create({
    data: {
      sku: "HMW-HAMPER-01",
      name: "Winter Hamper (assembled)",
      type: "ASSEMBLED",
      sellPricePence: gbp(59.99),
      barcode: "5060871330400",
      bomLines: {
        create: [
          { componentId: pid("HMW-BLANKET-GRY"), quantity: 1 },
          { componentId: pid("HMW-CANDLE-3PK"), quantity: 1 },
          { componentId: pid("PKG-GIFTBOX-L"), quantity: 1 },
          { componentId: pid("PKG-TISSUE-50"), quantity: 2 },
        ],
      },
    },
  });

  // ── Bundles ──────────────────────────────────────────────────────────────
  const bbqBundle = await db.product.create({
    data: {
      sku: "BDL-BBQ-STARTER",
      name: "BBQ Starter Bundle",
      type: "BUNDLE",
      sellPricePence: gbp(99.99),
      bomLines: {
        create: [
          { componentId: pid("GRD-FIREPIT-01"), quantity: 1 },
          { componentId: pid("GRD-TONGS-01"), quantity: 1 },
          { componentId: pid("GRD-CHRCL-5KG"), quantity: 2 },
        ],
      },
    },
  });
  const cosyBundle = await db.product.create({
    data: {
      sku: "BDL-COSY-NIGHT",
      name: "Cosy Night In Bundle",
      type: "BUNDLE",
      sellPricePence: gbp(59.99),
      bomLines: {
        create: [
          { componentId: pid("HMW-BLANKET-GRY"), quantity: 1 },
          { componentId: pid("HMW-CANDLE-3PK"), quantity: 1 },
          { componentId: pid("HMW-MUG-SET4"), quantity: 1 },
          { componentId: pid("PKG-GIFTBOX-L"), quantity: 1 },
        ],
      },
    },
  });
  products.set("BDL-BBQ-STARTER", bbqBundle);
  products.set("BDL-COSY-NIGHT", cosyBundle);

  // ── Product families & variants ──────────────────────────────────────────
  const blanketFam = await db.productFamily.create({
    data: { name: "Chunky Knit Blanket", code: "HMW-BLANKET" },
  });
  const firepitFam = await db.productFamily.create({
    data: { name: "Steel Fire Pit", code: "GRD-FIREPIT" },
  });
  await db.product.update({
    where: { id: pid("HMW-BLANKET-GRY") },
    data: { familyId: blanketFam.id, variant: "Grey" },
  });
  await db.product.update({
    where: { id: pid("GRD-FIREPIT-01") },
    data: { familyId: firepitFam.id, variant: "60 cm" },
  });
  const extraVariants = [
    { sku: "HMW-BLANKET-OCH", name: "Chunky Knit Blanket Ochre", weightGrams: 1800, baseCost: 8.9, sell: 34.99, supplierId: yiwu.id, barcode: "5060871330110", familyId: blanketFam.id, variant: "Ochre", opening: 35, openingCost: 8.9 },
    { sku: "HMW-BLANKET-NVY", name: "Chunky Knit Blanket Navy", weightGrams: 1800, baseCost: 8.9, sell: 34.99, supplierId: yiwu.id, barcode: "5060871330127", familyId: blanketFam.id, variant: "Navy", opening: 40, openingCost: 8.9 },
    { sku: "GRD-FIREPIT-02", name: "Steel Fire Pit 75cm", weightGrams: 16800, baseCost: 47.5, sell: 109.99, supplierId: sbt.id, barcode: "5060871330134", familyId: firepitFam.id, variant: "75 cm", opening: 18, openingCost: 47.5 },
  ];
  for (const v of extraVariants) {
    const created = await db.product.create({
      data: {
        sku: v.sku,
        name: v.name,
        barcode: v.barcode,
        weightGrams: v.weightGrams,
        baseCostPence: gbp(v.baseCost),
        sellPricePence: gbp(v.sell),
        supplierId: v.supplierId,
        familyId: v.familyId,
        variant: v.variant,
        type: "STANDARD",
      },
    });
    products.set(v.sku, created);
    await db.stockLevel.create({
      data: {
        productId: created.id,
        warehouseId: northampton.id,
        quantity: v.opening,
        openingQuantity: v.opening,
        openingUnitCostPence: gbp(v.openingCost),
      },
    });
    await logMove(
      created.id,
      northampton.id,
      v.opening,
      "OPENING",
      "Opening balance",
      null,
      daysAgo(40),
    );
  }

  // ── Categories, brands & placeholder images ──────────────────────────────
  const [garden, homeware, packaging] = await Promise.all([
    db.category.create({ data: { name: "Garden & Outdoor", code: "GARDEN" } }),
    db.category.create({ data: { name: "Homeware", code: "HOMEWARE" } }),
    db.category.create({ data: { name: "Packaging", code: "PACKAGING" } }),
  ]);
  const [emberOak, hearthHome, packRight] = await Promise.all([
    db.brand.create({ data: { name: "Ember & Oak", code: "EMBOAK" } }),
    db.brand.create({ data: { name: "Hearth Home", code: "HEARTH" } }),
    db.brand.create({ data: { name: "PackRight", code: "PACKRT" } }),
  ]);

  const imageDir = path.join(__dirname, "..", "public", "product-images");
  mkdirSync(imageDir, { recursive: true });

  for (const [sku, ref] of products) {
    const isGarden = sku.startsWith("GRD-") || sku === "BDL-BBQ-STARTER";
    const isPackaging = sku.startsWith("PKG-");
    const categoryId = isGarden ? garden.id : isPackaging ? packaging.id : homeware.id;
    const brandId = isGarden ? emberOak.id : isPackaging ? packRight.id : hearthHome.id;

    const product = await db.product.findUniqueOrThrow({ where: { id: ref.id } });
    const initials = product.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    const bg = isGarden ? "#0e7490" : isPackaging ? "#475569" : "#b45309";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="20" fill="${bg}"/><rect width="160" height="160" rx="20" fill="url(#g)"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/><stop offset="1" stop-color="#000000" stop-opacity="0.12"/></linearGradient></defs><text x="80" y="96" font-family="Helvetica, Arial, sans-serif" font-size="46" font-weight="700" text-anchor="middle" fill="#ffffff">${initials}</text></svg>`;
    const filename = `seed-${sku.toLowerCase()}.svg`;
    writeFileSync(path.join(imageDir, filename), svg);

    await db.product.update({
      where: { id: ref.id },
      data: { categoryId, brandId, imageUrl: `/product-images/${filename}` },
    });
  }

  // ── Opening stock (as-if synced from the 3PLs) ───────────────────────────
  const opening: [string, string, number, number][] = [
    // sku, warehouseId, qty, opening unit cost £
    ["GRD-FIREPIT-01", northampton.id, 40, 38.5],
    ["GRD-FIREPIT-01", leeds.id, 10, 38.5],
    ["GRD-TONGS-01", northampton.id, 150, 1.85],
    ["GRD-TONGS-01", leeds.id, 60, 1.85],
    ["GRD-CHRCL-5KG", northampton.id, 30, 3.2],
    ["GRD-PIZZA-STONE", northampton.id, 20, 4.1],
    ["HMW-BLANKET-GRY", northampton.id, 25, 8.9],
    ["HMW-BLANKET-GRY", leeds.id, 15, 8.9],
    ["HMW-CANDLE-3PK", northampton.id, 80, 2.6],
    ["HMW-MUG-SET4", northampton.id, 45, 3.75],
    ["HMW-MUG-SET4", leeds.id, 20, 3.75],
    ["HMW-LANTERN-01", northampton.id, 60, 2.95],
    ["PKG-GIFTBOX-L", northampton.id, 500, 0.85],
    ["PKG-TISSUE-50", northampton.id, 800, 1.1],
  ];
  for (const [sku, warehouseId, qty, cost] of opening) {
    await db.stockLevel.create({
      data: {
        productId: pid(sku),
        warehouseId,
        quantity: qty,
        openingQuantity: qty,
        openingUnitCostPence: gbp(cost),
      },
    });
    await logMove(pid(sku), warehouseId, qty, "OPENING", "Opening balance", null, daysAgo(40));
  }

  // ── The container: PO-0001 + PO-0002, both RECEIVED ──────────────────────
  const CONTAINER = "MSCU-4821907";

  const po1 = await db.purchaseOrder.create({
    data: {
      reference: "PO-0001",
      supplierId: sbt.id,
      status: "RECEIVED",
      containerRef: CONTAINER,
      expectedDate: daysAgo(31),
      placedAt: daysAgo(58),
      receivedAt: daysAgo(30),
      notes: "Spring garden range restock",
      lines: {
        create: [
          { productId: pid("GRD-FIREPIT-01"), quantity: 120, unitCostPence: gbp(38.5) },
          { productId: pid("GRD-TONGS-01"), quantity: 500, unitCostPence: gbp(1.85) },
          { productId: pid("GRD-CHRCL-5KG"), quantity: 400, unitCostPence: gbp(3.2) },
          { productId: pid("GRD-PIZZA-STONE"), quantity: 250, unitCostPence: gbp(4.1) },
        ],
      },
    },
    include: { lines: { include: { product: true } } },
  });

  const po2 = await db.purchaseOrder.create({
    data: {
      reference: "PO-0002",
      supplierId: yiwu.id,
      status: "RECEIVED",
      containerRef: CONTAINER,
      expectedDate: daysAgo(31),
      placedAt: daysAgo(55),
      receivedAt: daysAgo(30),
      notes: "Shared container with PO-0001",
      lines: {
        create: [
          { productId: pid("HMW-BLANKET-GRY"), quantity: 300, unitCostPence: gbp(8.9) },
          { productId: pid("HMW-CANDLE-3PK"), quantity: 600, unitCostPence: gbp(2.6) },
          { productId: pid("HMW-MUG-SET4"), quantity: 350, unitCostPence: gbp(3.75) },
        ],
      },
    },
    include: { lines: { include: { product: true } } },
  });

  // Apply the receipts to stock (received into Northampton).
  for (const po of [po1, po2]) {
    for (const line of po.lines) {
      await db.stockLevel.upsert({
        where: {
          productId_warehouseId: { productId: line.productId, warehouseId: northampton.id },
        },
        create: { productId: line.productId, warehouseId: northampton.id, quantity: line.quantity },
        update: { quantity: { increment: line.quantity } },
      });
      await logMove(
        line.productId,
        northampton.id,
        line.quantity,
        "PO_RECEIPT",
        po.reference,
        po.id,
        daysAgo(30),
      );
    }
  }

  // ── Draft PO for the live demo (place → receive → costs move) ────────────
  await db.purchaseOrder.create({
    data: {
      reference: "PO-0003",
      supplierId: sbt.id,
      status: "DRAFT",
      containerRef: "MSCU-5177302",
      expectedDate: daysAhead(21),
      notes: "Summer top-up, use this one for the walkthrough",
      lines: {
        create: [
          { productId: pid("GRD-FIREPIT-01"), quantity: 80, unitCostPence: gbp(39.2) },
          { productId: pid("GRD-CHRCL-5KG"), quantity: 600, unitCostPence: gbp(3.05) },
          { productId: pid("GRD-TONGS-01"), quantity: 300, unitCostPence: gbp(1.79) },
        ],
      },
    },
  });

  // ── Cost invoices, allocated with the real engine ────────────────────────
  const allLines = [...po1.lines, ...po2.lines].map((l) => ({
    lineId: l.id,
    quantity: l.quantity,
    unitCostPence: l.unitCostPence,
    unitWeightGrams: l.product.weightGrams,
  }));
  const po1Lines = allLines.slice(0, po1.lines.length);

  const invoices: {
    reference: string;
    vendor: string;
    type: string;
    amountPence: number;
    method: AllocationMethod;
    poIds: string[];
    lines: typeof allLines;
    date: Date;
  }[] = [
    {
      reference: "MAERSK-88671",
      vendor: "Maersk",
      type: "FREIGHT",
      amountPence: gbp(4200),
      method: "WEIGHT",
      poIds: [po1.id, po2.id],
      lines: allLines,
      date: daysAgo(10),
    },
    {
      reference: "HMRC-C79-0424",
      vendor: "HMRC",
      type: "DUTY",
      amountPence: gbp(1850),
      method: "VALUE",
      poIds: [po1.id, po2.id],
      lines: allLines,
      date: daysAgo(6),
    },
    {
      reference: "3PL-DEVAN-2211",
      vendor: "Northampton 3PL",
      type: "HANDLING",
      amountPence: gbp(320),
      method: "QUANTITY",
      poIds: [po1.id],
      lines: po1Lines,
      date: daysAgo(8),
    },
  ];

  for (const inv of invoices) {
    const outcome = allocateInvoice(inv.amountPence, inv.method, inv.lines);
    await db.costInvoice.create({
      data: {
        reference: inv.reference,
        vendor: inv.vendor,
        type: inv.type,
        amountPence: inv.amountPence,
        allocationMethod: inv.method,
        invoiceDate: inv.date,
        purchaseOrders: {
          create: inv.poIds.map((purchaseOrderId) => ({ purchaseOrderId })),
        },
        allocations: {
          create: outcome.results.map((r) => ({
            poLineId: r.lineId,
            amountPence: r.amountPence,
          })),
        },
      },
    });
  }

  // ── Channels (rules agreed on the customer call) ─────────────────────────
  const channels: { name: string; code: string; rules: RuleStep[] }[] = [
    {
      name: "Very",
      code: "very",
      rules: [
        { type: "oosThreshold", threshold: 5 },
        { type: "divide", by: 4, rounding: "floor" },
        { type: "blankWhenOos" },
      ],
    },
    {
      name: "Frasers Group",
      code: "frasers",
      rules: [
        { type: "subtract", amount: 20 },
        { type: "clamp", min: 0 },
        { type: "oosThreshold", threshold: 0 },
      ],
    },
    {
      name: "John Lewis",
      code: "john-lewis",
      rules: [
        { type: "subtract", amount: 10 },
        { type: "clamp", min: 0, max: 50 },
        { type: "oosThreshold", threshold: 0 },
      ],
    },
    {
      name: "Costco",
      code: "costco",
      rules: [
        { type: "oosThreshold", threshold: 10 },
        { type: "divide", by: 2, rounding: "floor" },
        { type: "blankWhenOos" },
      ],
    },
    {
      // Channel code matches the SupplyLens integration it represents,
      // in production the order sync stamps this channel on inbound orders.
      name: "Mirakl Tesco",
      code: "mirakl-tesco",
      rules: [
        { type: "subtract", amount: 15 },
        { type: "clamp", min: 0 },
        { type: "oosThreshold", threshold: 0 },
      ],
    },
  ];
  const channelIds = new Map<string, string>();
  for (const c of channels) {
    const created = await db.channel.create({
      data: { name: c.name, code: c.code, rulesJson: JSON.stringify(c.rules) },
    });
    channelIds.set(c.code, created.id);
  }

  // ── B2B portal: its channel, a price list, and a buyer login ─────────────
  {
    const portalChannel = await db.channel.create({
      data: { name: "B2B Portal", code: "b2b-portal", rulesJson: "[]" },
    });
    channelIds.set("b2b-portal", portalChannel.id);
  }


  // ── Sales team & customers ───────────────────────────────────────────────
  const [tommy, sarah, james] = await Promise.all([
    db.salesPerson.create({ data: { name: "Tommy Hale", email: "tommy@example.co.uk" } }),
    db.salesPerson.create({ data: { name: "Sarah Patel", email: "sarah@example.co.uk" } }),
    db.salesPerson.create({ data: { name: "James Kerr", email: "james@example.co.uk" } }),
  ]);

  const customerData = [
    { name: "The Range", code: "RANGE", sp: tommy.id, wh: northampton.id, terms: 60, phone: "01246 555 100", addr: "The Range DC 3\nAvonmouth Way\nBristol BS11 8DD" },
    { name: "Robert Dyas", code: "RDYAS", sp: sarah.id, wh: northampton.id, terms: 30, phone: "020 7555 2200", addr: "Robert Dyas NDC\nUnit 2, Fleming Way\nCrawley RH10 9JY" },
    { name: "GardenWorld Online", code: "GWO", sp: james.id, wh: leeds.id, terms: 14, phone: "0113 555 0340", addr: "GardenWorld Fulfilment\nGelderd Road\nLeeds LS12 6EU" },
    { name: "Harrods Wholesale", code: "HARW", sp: sarah.id, wh: northampton.id, terms: 45, phone: "020 7555 1849", addr: "Harrods Distribution Centre\nOsterley Park\nIsleworth TW7 4RB" },
    { name: "CozyHome Trade", code: "COZY", sp: tommy.id, wh: northampton.id, terms: 30, phone: "0161 555 7810", addr: "CozyHome Trade Ltd\nUnit 9, Trafford Point\nManchester M17 1WA" },
  ];
  const customers = new Map<string, { id: string; sp: string; wh: string; terms: number }>();
  for (const c of customerData) {
    const created = await db.customer.create({
      data: {
        name: c.name,
        code: c.code,
        defaultSalesPersonId: c.sp,
        defaultWarehouseId: c.wh,
        paymentTermsDays: c.terms,
        phone: c.phone,
        deliveryAddress: c.addr,
      },
    });
    customers.set(c.code, { id: created.id, sp: c.sp, wh: c.wh, terms: c.terms });
  }

  // ── Named delivery locations (code = API sync key) ───────────────────────
  const defaultLocation = new Map<
    string,
    { id: string; address: string; contact: string | null }
  >();
  const locationData: Record<
    string,
    { code: string; name: string; address: string; contact: string; isDefault: boolean }[]
  > = {
    RANGE: [
      { code: "AVONMOUTH-DC3", name: "Avonmouth DC 3", address: "The Range DC 3\nAvonmouth Way\nBristol BS11 8DD", contact: "Goods In, 01246 555 100", isDefault: true },
      { code: "STORE-112", name: "Store 112, Bristol", address: "The Range Store 112\nEastgate Retail Park\nBristol BS5 6XX", contact: "Store manager, 0117 555 0980", isDefault: false },
    ],
    RDYAS: [
      { code: "CRAWLEY-NDC", name: "Crawley NDC", address: "Robert Dyas NDC\nUnit 2, Fleming Way\nCrawley RH10 9JY", contact: "Goods In, 020 7555 2200", isDefault: true },
    ],
    GWO: [
      { code: "LEEDS-FULFIL", name: "Leeds Fulfilment", address: "GardenWorld Fulfilment\nGelderd Road\nLeeds LS12 6EU", contact: "Goods In, 0113 555 0340", isDefault: true },
    ],
    HARW: [
      { code: "OSTERLEY-DC", name: "Osterley DC", address: "Harrods Distribution Centre\nOsterley Park\nIsleworth TW7 4RB", contact: "Goods In, 020 7555 1849", isDefault: true },
    ],
    COZY: [
      { code: "TRAFFORD-9", name: "Trafford Point Unit 9", address: "CozyHome Trade Ltd\nUnit 9, Trafford Point\nManchester M17 1WA", contact: "Goods In, 0161 555 7810", isDefault: true },
    ],
  };
  for (const [custCode, locations] of Object.entries(locationData)) {
    const customer = customers.get(custCode)!;
    for (const loc of locations) {
      const created = await db.customerLocation.create({
        data: { customerId: customer.id, ...loc },
      });
      if (loc.isDefault) {
        defaultLocation.set(custCode, {
          id: created.id,
          address: created.address,
          contact: created.contact,
        });
      }
    }
  }

  // ── Average landed cost per product (same maths as the app) ─────────────
  // Used to snapshot COGS on dispatched seed orders.
  const allLevels = await db.stockLevel.findMany();
  const receivedLines = await db.purchaseOrderLine.findMany({
    where: { purchaseOrder: { status: "RECEIVED" } },
    include: { allocations: true },
  });
  const trancheTotals = new Map<string, { qty: number; cost: number }>();
  const addTranche = (productId: string, qty: number, unitCost: number) => {
    const t = trancheTotals.get(productId) ?? { qty: 0, cost: 0 };
    t.qty += qty;
    t.cost += qty * unitCost;
    trancheTotals.set(productId, t);
  };
  for (const l of allLevels) {
    if (l.openingQuantity > 0) addTranche(l.productId, l.openingQuantity, l.openingUnitCostPence);
  }
  for (const l of receivedLines) {
    const allocated = l.allocations.reduce((s, a) => s + a.amountPence, 0);
    addTranche(l.productId, l.quantity, l.unitCostPence + allocated / l.quantity);
  }
  const avgLanded = new Map(
    [...trancheTotals.entries()].map(([id, t]) => [id, t.qty > 0 ? t.cost / t.qty : 0]),
  );
  const bomByBundle = new Map<string, { componentId: string; quantity: number }[]>();
  for (const bl of await db.bomLine.findMany()) {
    const list = bomByBundle.get(bl.bundleId) ?? [];
    list.push({ componentId: bl.componentId, quantity: bl.quantity });
    bomByBundle.set(bl.bundleId, list);
  }
  const productTypes = new Map(
    (await db.product.findMany()).map((p) => [p.id, p.type]),
  );
  const unitCogs = (productId: string): number => {
    if (productTypes.get(productId) === "BUNDLE") {
      return (bomByBundle.get(productId) ?? []).reduce(
        (s, c) => s + (avgLanded.get(c.componentId) ?? 0) * c.quantity,
        0,
      );
    }
    return avgLanded.get(productId) ?? 0;
  };

  // HARW buys at list prices, and Jane can sign in to the portal.
  {
    const harw = customers.get("HARW")!;
    await db.customerPrice.createMany({
      data: [
        { customerId: harw.id, productId: pid("GRD-TONGS-01"), unitPricePence: gbp(5.49) },
        { customerId: harw.id, productId: pid("HMW-BLANKET-GRY"), unitPricePence: gbp(26.99) },
        { customerId: harw.id, productId: pid("PKG-GIFTBOX-L"), unitPricePence: gbp(2.29) },
      ],
    });
    await db.portalUser.create({
      data: {
        customerId: harw.id,
        email: "jane@harrods-demo.co.uk",
        name: "Jane Porter",
        passwordHash: hashPassword("demo1234"),
      },
    });
  }

  // ── Sales history (last ~4 weeks) ────────────────────────────────────────
  let soSeq = 0;
  let invSeq = 0;
  let dspSeq = 0;
  async function seedSale(opts: {
    customer: string;
    ago: number;
    status: "DRAFT" | "DISPATCHED" | "INVOICED";
    warehouseId?: string;
    channel?: string; // channel code, e.g. "mirakl-tesco"; omit = manual/wholesale
    po?: string; // customer's PO number
    ext?: string; // channel order ref
    service?: string; // shipping service
    tracking?: string;
    shipping?: number; // carriage charged, £
    instructions?: string;
    gift?: string;
    tax?: "EXCLUSIVE" | "INCLUSIVE" | "NONE";
    preOrder?: boolean;
    /** SKUs left on a second, still-picking despatch, demos split fulfilment. */
    splitPickingSkus?: string[];
    lines: [string, number, number, number?][]; // sku, qty, unit price £, discount %
  }) {
    const c = customers.get(opts.customer)!;
    const customerRecord = customerData.find((x) => x.code === opts.customer)!;
    const warehouseId = opts.warehouseId ?? c.wh;
    const splitSkus = new Set(opts.splitPickingSkus ?? []);
    const isDraft = opts.status === "DRAFT";
    soSeq += 1;
    const order = await db.salesOrder.create({
      data: {
        reference: `SO-${String(soSeq).padStart(4, "0")}`,
        customerId: c.id,
        salesPersonId: c.sp,
        warehouseId,
        channelId: opts.channel ? (channelIds.get(opts.channel) ?? null) : null,
        // "DISPATCHED" seeds land as OPEN orders with despatch documents.
        status: opts.status === "DISPATCHED" ? "OPEN" : opts.status,
        taxTreatment: opts.tax ?? "EXCLUSIVE",
        isPreOrder: opts.preOrder ?? false,
        orderDate: daysAgo(opts.ago),
        requiredDate: daysAgo(opts.ago - 7),
        dispatchedAt: isDraft ? null : daysAgo(Math.max(opts.ago - 1, 0)),
        customerPoNumber: opts.po ?? null,
        externalRef: opts.ext ?? null,
        deliveryLocationId: defaultLocation.get(opts.customer)?.id ?? null,
        deliveryAddress: defaultLocation.get(opts.customer)?.address ?? customerRecord.addr,
        deliveryContact:
          defaultLocation.get(opts.customer)?.contact ?? `Goods In, ${customerRecord.phone}`,
        shippingService: opts.service ?? null,
        shippingPence: opts.shipping ? gbp(opts.shipping) : 0,
        shippingInstructions: opts.instructions ?? null,
        giftMessage: opts.gift ?? null,
        lines: {
          create: opts.lines.map(([sku, quantity, price, disc]) => ({
            productId: pid(sku),
            originalQty: quantity,
            quantity,
            unitPricePence: gbp(price),
            discountPct: disc ?? 0,
            unitCogsPence:
              isDraft || splitSkus.has(sku) ? null : unitCogs(pid(sku)),
          })),
        },
      },
      include: { lines: { include: { product: { include: { bomLines: true } } } } },
    });

    if (!isDraft) {
      const despatchedLines = order.lines.filter(
        (l) => !splitSkus.has(l.product.sku),
      );
      const pickingLines = order.lines.filter((l) => splitSkus.has(l.product.sku));

      // Deduct physical stock for despatched lines (bundles explode).
      const required = new Map<string, number>();
      for (const line of despatchedLines) {
        if (line.product.type === "BUNDLE") {
          for (const bom of line.product.bomLines) {
            required.set(
              bom.componentId,
              (required.get(bom.componentId) ?? 0) + bom.quantity * line.quantity,
            );
          }
        } else {
          required.set(line.productId, (required.get(line.productId) ?? 0) + line.quantity);
        }
      }
      dspSeq += 1;
      const dspRef = `DSP-${String(dspSeq).padStart(4, "0")}`;
      for (const [productId, qty] of required) {
        await db.stockLevel.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data: { quantity: { decrement: qty } },
        });
        await logMove(
          productId,
          warehouseId,
          -qty,
          "DESPATCH",
          dspRef,
          order.id,
          daysAgo(Math.max(opts.ago - 1, 0)),
        );
      }

      // The fulfilment documents.
      await db.despatch.create({
        data: {
          reference: dspRef,
          salesOrderId: order.id,
          status: "DESPATCHED",
          shippingService: opts.service ?? null,
          trackingNumber: opts.tracking ?? null,
          createdAt: daysAgo(opts.ago),
          pickedAt: daysAgo(Math.max(opts.ago - 1, 0)),
          despatchedAt: daysAgo(Math.max(opts.ago - 1, 0)),
          lines: {
            create: despatchedLines.map((l) => ({
              orderLineId: l.id,
              quantity: l.quantity,
              pickedQty: l.quantity,
              despatchedQty: l.quantity,
              unitCogsPence: l.unitCogsPence,
            })),
          },
        },
      });
      if (pickingLines.length > 0) {
        dspSeq += 1;
        await db.despatch.create({
          data: {
            reference: `DSP-${String(dspSeq).padStart(4, "0")}`,
            salesOrderId: order.id,
            status: "PICKING",
            shippingService: opts.service ?? null,
            createdAt: daysAgo(Math.max(opts.ago - 1, 0)),
            lines: {
              create: pickingLines.map((l) => ({
                orderLineId: l.id,
                quantity: l.quantity,
              })),
            },
          },
        });
      }
    }

    if (opts.status === "INVOICED") {
      invSeq += 1;
      const { netPence, vatPence, grossPence } = orderTotalsPence(
        order.lines,
        order.shippingPence,
        order.taxTreatment,
      );
      const invoiceDate = daysAgo(Math.max(opts.ago - 1, 0));
      await db.invoice.create({
        data: {
          number: `INV-${String(invSeq).padStart(4, "0")}`,
          salesOrderId: order.id,
          invoiceDate,
          dueDate: new Date(invoiceDate.getTime() + c.terms * 24 * 60 * 60 * 1000),
          netPence,
          vatPence,
          grossPence,
        },
      });
    }
    return order;
  }

  await seedSale({ customer: "RANGE", ago: 27, status: "INVOICED", po: "TR-PO-99118", service: "Palletways Economy", tracking: "PW8827741", shipping: 45, instructions: "Book in via supplier portal 48h ahead. Tail-lift required.", lines: [["GRD-FIREPIT-01", 10, 74.99], ["GRD-TONGS-01", 40, 5.99]] });
  const blanketOrder = await seedSale({ customer: "RDYAS", ago: 25, status: "INVOICED", po: "RD-84772", service: "DHL Parcel UK", tracking: "JD0148812309", shipping: 12.5, lines: [["HMW-BLANKET-GRY", 30, 27.99], ["HMW-CANDLE-3PK", 60, 11.99]] });
  await seedSale({ customer: "GWO", ago: 24, status: "INVOICED", channel: "mirakl-tesco", ext: "MIRAKL-TSC-284119", service: "DPD Next Day", tracking: "15501982277", tax: "INCLUSIVE", lines: [["GRD-FIREPIT-01", 4, 79.99], ["GRD-TONGS-01", 20, 6.49, 5]] });
  await seedSale({ customer: "HARW", ago: 22, status: "INVOICED", po: "HW-2026-4471", service: "DHL Parcel UK", tracking: "JD0148820441", shipping: 18, lines: [["HMW-MUG-SET4", 40, 14.99], ["PKG-GIFTBOX-L", 100, 2.49]] });
  await seedSale({ customer: "COZY", ago: 20, status: "INVOICED", channel: "very", ext: "VERY-90337721", service: "Evri Standard", tracking: "H0099828871", gift: "Enjoy your new cosy set!, The CozyHome team", tax: "INCLUSIVE", lines: [["BDL-COSY-NIGHT", 20, 49.99]] });
  await seedSale({ customer: "RANGE", ago: 18, status: "INVOICED", lines: [["GRD-CHRCL-5KG", 80, 7.99], ["GRD-PIZZA-STONE", 30, 15.99]] });
  await seedSale({ customer: "RDYAS", ago: 16, status: "INVOICED", lines: [["HMW-LANTERN-01", 25, 9.99], ["HMW-CANDLE-3PK", 50, 11.49]] });
  const bundleOrder = await seedSale({ customer: "HARW", ago: 14, status: "INVOICED", lines: [["BDL-BBQ-STARTER", 12, 84.99]] });
  await seedSale({ customer: "GWO", ago: 12, status: "INVOICED", warehouseId: northampton.id, channel: "mirakl-tesco", lines: [["HMW-BLANKET-GRY", 25, 26.99], ["PKG-TISSUE-50", 100, 2.79]] });
  await seedSale({ customer: "COZY", ago: 10, status: "INVOICED", lines: [["HMW-MUG-SET4", 30, 13.99], ["HMW-CANDLE-3PK", 40, 10.99]] });
  await seedSale({ customer: "RANGE", ago: 7, status: "INVOICED", po: "TR-PO-99870", service: "Palletways Economy", tracking: "PW8830112", shipping: 45, instructions: "Book in via supplier portal 48h ahead. Tail-lift required.", lines: [["GRD-FIREPIT-01", 15, 72.99, 10], ["GRD-CHRCL-5KG", 60, 7.49]] });
  await seedSale({ customer: "RDYAS", ago: 5, status: "DISPATCHED", po: "RD-85102", service: "DHL Parcel UK", tracking: "JD0148899917", shipping: 12.5, splitPickingSkus: ["GRD-TONGS-01"], lines: [["GRD-PIZZA-STONE", 40, 14.99], ["GRD-TONGS-01", 60, 5.49]] });
  await seedSale({ customer: "HARW", ago: 2, status: "DRAFT", po: "HW-2026-4512", lines: [["BDL-BBQ-STARTER", 10, 84.99], ["HMW-LANTERN-01", 20, 9.99]] });
  await seedSale({ customer: "GWO", ago: 1, status: "DRAFT", channel: "mirakl-tesco", ext: "MIRAKL-TSC-291447", lines: [["HMW-BLANKET-GRY", 20, 27.99]] });
  // Pre-order: sold ahead, stock secured the moment it exists.
  await seedSale({ customer: "RANGE", ago: 1, status: "DRAFT", preOrder: true, po: "TR-PO-99991", lines: [["GRD-FIREPIT-01", 30, 76.99]] });

  // ── The scoping-doc example: EDI order 100 → confirmed 80 → despatched 75 ──
  // Fill rates: 80% confirmation, 75% dispatch vs original, 93.75% vs confirmed.
  {
    soSeq += 1;
    const c = customers.get("HARW")!;
    const order = await db.salesOrder.create({
      data: {
        reference: `SO-${String(soSeq).padStart(4, "0")}`,
        customerId: c.id,
        salesPersonId: c.sp,
        warehouseId: northampton.id,
        channelId: channelIds.get("mirakl-tesco") ?? null,
        status: "OPEN",
        orderDate: daysAgo(3),
        requiredDate: daysAhead(4),
        dispatchedAt: daysAgo(2),
        customerPoNumber: "HW-EDI-4600",
        externalRef: "EDI-850-000900",
        deliveryAddress: defaultLocation.get("HARW")?.address,
        deliveryLocationId: defaultLocation.get("HARW")?.id,
        deliveryContact: defaultLocation.get("HARW")?.contact,
        shippingService: "DHL Parcel UK",
        shippingPence: 0,
        lines: {
          create: [
            {
              productId: pid("PKG-TISSUE-50"),
              originalQty: 100,
              quantity: 80,
              unitPricePence: gbp(2.79),
              unitCogsPence: unitCogs(pid("PKG-TISSUE-50")),
            },
          ],
        },
      },
      include: { lines: true },
    });
    await db.orderAmendment.create({
      data: {
        salesOrderId: order.id,
        sku: "PKG-TISSUE-50",
        field: "quantity",
        oldValue: "100",
        newValue: "80",
        reason: "Stock shortage, 80 agreed with buyer",
        source: "UI",
        createdAt: daysAgo(3),
      },
    });
    dspSeq += 1;
    const dspRef = `DSP-${String(dspSeq).padStart(4, "0")}`;
    await db.stockLevel.update({
      where: {
        productId_warehouseId: { productId: pid("PKG-TISSUE-50"), warehouseId: northampton.id },
      },
      data: { quantity: { decrement: 75 } },
    });
    await logMove(
      pid("PKG-TISSUE-50"),
      northampton.id,
      -75,
      "DESPATCH",
      dspRef,
      order.id,
      daysAgo(2),
    );
    await db.despatch.create({
      data: {
        reference: dspRef,
        salesOrderId: order.id,
        status: "DESPATCHED",
        shippingService: "DHL Parcel UK",
        trackingNumber: "JD0148900551",
        createdAt: daysAgo(3),
        pickedAt: daysAgo(2),
        despatchedAt: daysAgo(2),
        lines: {
          create: [
            {
              orderLineId: order.lines[0].id,
              quantity: 80,
              pickedQty: 75,
              despatchedQty: 75,
              unitCogsPence: order.lines[0].unitCogsPence,
            },
          ],
        },
      },
    });
  }

  // ── Steve's UoM example: retailer sends qty 16 against the pack-of-6 outer
  // barcode → 16 packs recorded, 96 eaches committed from stock. ─────────────
  {
    soSeq += 1;
    const c = customers.get("RANGE")!;
    await db.salesOrder.create({
      data: {
        reference: `SO-${String(soSeq).padStart(4, "0")}`,
        customerId: c.id,
        salesPersonId: c.sp,
        warehouseId: c.wh,
        channelId: channelIds.get("mirakl-tesco") ?? null,
        status: "DRAFT",
        orderDate: daysAgo(1),
        requiredDate: daysAhead(6),
        customerPoNumber: "TR-PO-EDI-1042",
        externalRef: "EDI-850-001042",
        deliveryLocationId: defaultLocation.get("RANGE")?.id,
        deliveryAddress: defaultLocation.get("RANGE")?.address,
        deliveryContact: defaultLocation.get("RANGE")?.contact,
        shippingService: "Palletways Economy",
        lines: {
          create: [
            {
              productId: pid("GRD-TONGS-01"),
              originalQty: 16,
              quantity: 16,
              uomCode: "PACK6",
              unitsPerUom: 6,
              unitPricePence: gbp(29.99), // per pack
            },
            {
              productId: pid("GRD-CHRCL-5KG"),
              originalQty: 5,
              quantity: 5,
              uomCode: "CASE4",
              unitsPerUom: 4,
              unitPricePence: gbp(27.99), // per case
            },
          ],
        },
      },
    });
  }

  // ── Credit notes ─────────────────────────────────────────────────────────
  let crnSeq = 0;
  async function seedCredit(opts: {
    order: Awaited<ReturnType<typeof seedSale>>;
    ago: number;
    reason: string;
    restock: boolean;
    warehouseId?: string;
    lines: [string, number, number][]; // sku, qty, unit price £
  }) {
    crnSeq += 1;
    const net = opts.lines.reduce((s, [, qty, price]) => s + qty * gbp(price), 0);
    const vat = Math.round(net * 0.2);
    await db.creditNote.create({
      data: {
        number: `CRN-${String(crnSeq).padStart(4, "0")}`,
        salesOrderId: opts.order.id,
        reason: opts.reason,
        restock: opts.restock,
        warehouseId: opts.restock ? opts.warehouseId : null,
        creditDate: daysAgo(opts.ago),
        netPence: net,
        vatPence: vat,
        grossPence: net + vat,
        lines: {
          create: opts.lines.map(([sku, quantity, price]) => {
            const orderLine = opts.order.lines.find((l) => l.productId === pid(sku))!;
            return {
              productId: pid(sku),
              quantity,
              unitPricePence: gbp(price),
              unitCogsPence: orderLine.unitCogsPence,
            };
          }),
        },
      },
    });
    if (opts.restock && opts.warehouseId) {
      for (const [sku, quantity] of opts.lines) {
        const product = opts.order.lines.find((l) => l.productId === pid(sku))!.product;
        const returned =
          product.type === "BUNDLE"
            ? product.bomLines.map((b) => [b.componentId, b.quantity * quantity] as const)
            : [[pid(sku), quantity] as const];
        for (const [productId, qty] of returned) {
          await db.stockLevel.upsert({
            where: { productId_warehouseId: { productId, warehouseId: opts.warehouseId } },
            create: { productId, warehouseId: opts.warehouseId, quantity: qty },
            update: { quantity: { increment: qty } },
          });
          await logMove(
            productId,
            opts.warehouseId,
            qty,
            "CREDIT_RESTOCK",
            `CRN-${String(crnSeq).padStart(4, "0")}`,
            opts.order.id,
            daysAgo(opts.ago),
          );
        }
      }
    }
  }

  // ── Customer return (RMA): 4 blankets back, 3 restocked, 1 written off ───
  // Receiving the RMA raises its credit note (CRN-0001) automatically.
  {
    const rmaLine = blanketOrder.lines.find((l) => l.productId === pid("HMW-BLANKET-GRY"))!;
    crnSeq += 1;
    const crnNumber = `CRN-${String(crnSeq).padStart(4, "0")}`;
    const creditNet = 4 * gbp(27.99);
    const creditVat = Math.round(creditNet * 0.2);
    const credit = await db.creditNote.create({
      data: {
        number: crnNumber,
        salesOrderId: blanketOrder.id,
        reason: "Customer return RMA-0001, unwanted",
        restock: false, // stock handled by the RMA
        netPence: creditNet,
        vatPence: creditVat,
        grossPence: creditNet + creditVat,
        creditDate: daysAgo(8),
        lines: {
          create: [
            {
              productId: pid("HMW-BLANKET-GRY"),
              quantity: 4,
              unitPricePence: gbp(27.99),
              unitCogsPence: rmaLine.unitCogsPence,
            },
          ],
        },
      },
    });
    await db.customerReturn.create({
      data: {
        reference: "RMA-0001",
        salesOrderId: blanketOrder.id,
        warehouseId: northampton.id,
        status: "RECEIVED",
        reason: "Unwanted, customer changed mind",
        createdAt: daysAgo(10),
        receivedAt: daysAgo(8),
        creditNoteId: credit.id,
        lines: {
          create: [
            {
              orderLineId: rmaLine.id,
              quantity: 4,
              restockQty: 3,
              writeOffQty: 1,
              unitCogsPence: rmaLine.unitCogsPence,
            },
          ],
        },
      },
    });
    await db.stockLevel.update({
      where: {
        productId_warehouseId: { productId: pid("HMW-BLANKET-GRY"), warehouseId: northampton.id },
      },
      data: { quantity: { increment: 3 } },
    });
    await logMove(
      pid("HMW-BLANKET-GRY"),
      northampton.id,
      3,
      "CUSTOMER_RETURN",
      "RMA-0001",
      blanketOrder.id,
      daysAgo(8),
    );
  }

  await seedCredit({
    order: bundleOrder,
    ago: 9,
    reason: "Damaged in transit",
    restock: false,
    lines: [["BDL-BBQ-STARTER", 1, 84.99]],
  });

  // ── An RMA still travelling back, awaiting receipt ───────────────────────
  await db.customerReturn.create({
    data: {
      reference: "RMA-0002",
      salesOrderId: bundleOrder.id,
      warehouseId: northampton.id,
      status: "AWAITING",
      reason: "Wrong item ordered, awaiting collection",
      createdAt: daysAgo(2),
      lines: {
        create: [
          {
            orderLineId: bundleOrder.lines[0].id,
            quantity: 1,
          },
        ],
      },
    },
  });

  // ── Supplier return (RTV): damaged lantern batch back to Yiwu ────────────
  {
    const rtv = await db.supplierReturn.create({
      data: {
        reference: "RTV-0001",
        supplierId: yiwu.id,
        warehouseId: northampton.id,
        status: "SENT",
        reason: "Damaged batch, cracked glass on arrival",
        createdAt: daysAgo(5),
        sentAt: daysAgo(4),
        lines: {
          create: [
            {
              productId: pid("HMW-LANTERN-01"),
              quantity: 6,
              unitCostPence: Math.round(unitCogs(pid("HMW-LANTERN-01"))),
            },
          ],
        },
      },
    });
    await db.stockLevel.update({
      where: {
        productId_warehouseId: { productId: pid("HMW-LANTERN-01"), warehouseId: northampton.id },
      },
      data: { quantity: { decrement: 6 } },
    });
    await logMove(
      pid("HMW-LANTERN-01"),
      northampton.id,
      -6,
      "SUPPLIER_RETURN",
      rtv.reference,
      null,
      daysAgo(4),
    );
  }

  // ── Stock reservations (the pre-order "secure it" holds) ─────────────────
  await db.stockReservation.create({
    data: {
      reference: "RSV-0001",
      productId: pid("GRD-FIREPIT-01"),
      warehouseId: northampton.id,
      quantity: 60,
      customerId: customers.get("RANGE")!.id,
      reason: "Autumn pre-order launch, held for The Range",
      expiresAt: daysAhead(21),
      createdAt: daysAgo(3),
    },
  });
  // Inbound hold: secures stock still on the water, pending until PO-0003 is
  // received, at which point it activates in the receipt transaction.
  const po3 = await db.purchaseOrder.findUniqueOrThrow({ where: { reference: "PO-0003" } });
  await db.stockReservation.create({
    data: {
      reference: "RSV-0003",
      productId: pid("GRD-FIREPIT-01"),
      warehouseId: northampton.id,
      quantity: 50,
      customerId: customers.get("RANGE")!.id,
      purchaseOrderId: po3.id,
      status: "PENDING",
      reason: "Pre-order campaign, container on the water (PO-0003)",
      expiresAt: daysAhead(45),
      createdAt: daysAgo(1),
    },
  });
  await db.stockReservation.create({
    data: {
      reference: "RSV-0002",
      productId: pid("HMW-CANDLE-3PK"),
      warehouseId: northampton.id,
      quantity: 100,
      reason: "Very channel launch buffer",
      expiresAt: daysAhead(14),
      createdAt: daysAgo(2),
    },
  });

  // ── Stock adjustment + warehouse transfer (today, after all other moves) ──
  {
    const adj = await db.stockAdjustment.create({
      data: {
        reference: "ADJ-0001",
        warehouseId: northampton.id,
        reason: "Stocktake variance, aisle C count",
        notes: "Count sheet C3; two mugs found behind racking, three lanterns broken",
        lines: {
          create: [
            { productId: pid("HMW-MUG-SET4"), quantityDelta: 2 },
            { productId: pid("HMW-LANTERN-01"), quantityDelta: -3 },
          ],
        },
      },
    });
    for (const [sku, delta] of [
      ["HMW-MUG-SET4", 2],
      ["HMW-LANTERN-01", -3],
    ] as const) {
      await db.stockLevel.update({
        where: { productId_warehouseId: { productId: pid(sku), warehouseId: northampton.id } },
        data: { quantity: { increment: delta } },
      });
      await logMove(
        pid(sku),
        northampton.id,
        delta,
        "ADJUSTMENT",
        "ADJ-0001",
        adj.id,
        daysAgo(0),
      );
    }

    const trf = await db.warehouseTransfer.create({
      data: {
        reference: "TRF-0001",
        fromWarehouseId: northampton.id,
        toWarehouseId: leeds.id,
        notes: "Rebalancing pizza stones for northern retailers",
        lines: { create: [{ productId: pid("GRD-PIZZA-STONE"), quantity: 25 }] },
      },
    });
    await db.stockLevel.update({
      where: {
        productId_warehouseId: { productId: pid("GRD-PIZZA-STONE"), warehouseId: northampton.id },
      },
      data: { quantity: { decrement: 25 } },
    });
    await logMove(pid("GRD-PIZZA-STONE"), northampton.id, -25, "TRANSFER", "TRF-0001", trf.id, daysAgo(0));
    await db.stockLevel.upsert({
      where: {
        productId_warehouseId: { productId: pid("GRD-PIZZA-STONE"), warehouseId: leeds.id },
      },
      create: { productId: pid("GRD-PIZZA-STONE"), warehouseId: leeds.id, quantity: 25 },
      update: { quantity: { increment: 25 } },
    });
    await logMove(pid("GRD-PIZZA-STONE"), leeds.id, 25, "TRANSFER", "TRF-0001", trf.id, daysAgo(0));
  }

  // ── Stock journals: the accounting outbox, backfilled for seeded history ──
  // PO receipts show as already POSTED to Xero; despatch COGS and the
  // adjustment sit PENDING, ready for the accounting-sync demo to drain.
  {
    let sjSeq = 0;
    const journal = async (opts: {
      type: string;
      sourceRef: string;
      memo: string;
      total: number;
      debit: string;
      credit: string;
      when: Date;
      posted?: boolean;
    }) => {
      const total = Math.round(opts.total);
      if (total <= 0) return;
      sjSeq += 1;
      await db.stockJournal.create({
        data: {
          reference: `SJ-${String(sjSeq).padStart(4, "0")}`,
          type: opts.type,
          sourceRef: opts.sourceRef,
          memo: opts.memo,
          totalPence: total,
          status: opts.posted ? "POSTED" : "PENDING",
          postedAt: opts.posted ? opts.when : null,
          externalRef: opts.posted ? `XERO-MJ-${8800 + sjSeq}` : null,
          createdAt: opts.when,
          lines: {
            create: [
              { account: opts.debit, debitPence: total },
              { account: opts.credit, creditPence: total },
            ],
          },
        },
      });
    };

    const receivedPos = await db.purchaseOrder.findMany({
      where: { status: "RECEIVED" },
      include: { lines: true },
      orderBy: { reference: "asc" },
    });
    for (const po of receivedPos) {
      await journal({
        type: "PO_RECEIPT",
        sourceRef: po.reference,
        memo: `Goods received ${po.reference}`,
        total: po.lines.reduce((s, l) => s + l.quantity * l.unitCostPence, 0),
        debit: "Stock on Hand",
        credit: "Goods Received Not Invoiced",
        when: po.receivedAt ?? daysAgo(30),
        posted: true,
      });
    }
    const shippedDespatches = await db.despatch.findMany({
      where: { status: "DESPATCHED" },
      include: { lines: true, salesOrder: { select: { reference: true } } },
      orderBy: { reference: "asc" },
    });
    for (const d of shippedDespatches) {
      await journal({
        type: "DESPATCH_COGS",
        sourceRef: d.reference,
        memo: `COGS for ${d.reference} (${d.salesOrder.reference})`,
        total: d.lines.reduce((s, l) => s + l.despatchedQty * (l.unitCogsPence ?? 0), 0),
        debit: "Cost of Goods Sold",
        credit: "Stock on Hand",
        when: d.despatchedAt ?? daysAgo(1),
      });
    }
    // ADJ-0001: +2 mugs, −3 lanterns at average landed, value both directions.
    const mugAvg = avgLanded.get(pid("HMW-MUG-SET4")) ?? 0;
    const lanternAvg = avgLanded.get(pid("HMW-LANTERN-01")) ?? 0;
    await journal({
      type: "ADJUSTMENT",
      sourceRef: "ADJ-0001",
      memo: "ADJ-0001: Stocktake variance, aisle C count (found)",
      total: 2 * mugAvg,
      debit: "Stock on Hand",
      credit: "Stock Adjustments",
      when: daysAgo(0),
    });
    await journal({
      type: "ADJUSTMENT",
      sourceRef: "ADJ-0001",
      memo: "ADJ-0001: Stocktake variance, aisle C count (lost)",
      total: 3 * lanternAvg,
      debit: "Stock Adjustments",
      credit: "Stock on Hand",
      when: daysAgo(0),
    });
  }

  // ── Production: one completed hamper build (with the story numbers) and a
  // draft plan waiting to start ─────────────────────────────────────────────
  {
    const bomPer = [
      ["HMW-BLANKET-GRY", 1],
      ["HMW-CANDLE-3PK", 1],
      ["PKG-GIFTBOX-L", 1],
      ["PKG-TISSUE-50", 2],
    ] as const;
    const madeQty = 25;
    const overhead = gbp(45); // 3 hours assembly labour
    let componentValue = 0;
    const bld = await db.productionOrder.create({
      data: {
        reference: "BLD-0001",
        productId: hamper.id,
        warehouseId: northampton.id,
        status: "COMPLETED",
        plannedQty: madeQty,
        actualQty: madeQty,
        overheadPence: overhead,
        overheadNote: "3 hours assembly labour",
        notes: "First hamper run for the winter range",
        createdAt: daysAgo(1),
        startedAt: daysAgo(1),
        completedAt: daysAgo(0),
      },
    });
    for (const [sku, per] of bomPer) {
      const qty = per * madeQty;
      const cost = avgLanded.get(pid(sku)) ?? 0;
      componentValue += qty * cost;
      await db.productionOrderLine.create({
        data: {
          orderId: bld.id,
          componentId: pid(sku),
          plannedQty: qty,
          actualQty: qty,
          unitCostPence: cost,
        },
      });
      await db.stockLevel.update({
        where: { productId_warehouseId: { productId: pid(sku), warehouseId: northampton.id } },
        data: { quantity: { decrement: qty } },
      });
      await logMove(pid(sku), northampton.id, -qty, "ASSEMBLY_BUILD", "BLD-0001", bld.id, daysAgo(1));
    }
    await db.stockLevel.upsert({
      where: { productId_warehouseId: { productId: hamper.id, warehouseId: northampton.id } },
      create: { productId: hamper.id, warehouseId: northampton.id, quantity: madeQty },
      update: { quantity: { increment: madeQty } },
    });
    await logMove(hamper.id, northampton.id, madeQty, "ASSEMBLY_BUILD", "BLD-0001", bld.id, daysAgo(0));
    const cv = Math.round(componentValue);
    await db.stockJournal.create({
      data: {
        reference: `SJ-${String((await db.stockJournal.count()) + 1).padStart(4, "0")}`,
        type: "PRODUCTION",
        sourceRef: "BLD-0001",
        sourceId: bld.id,
        memo: "Build started BLD-0001: components into WIP",
        totalPence: cv,
        createdAt: daysAgo(1),
        lines: {
          create: [
            { account: "Work in Progress", debitPence: cv },
            { account: "Stock on Hand", creditPence: cv },
          ],
        },
      },
    });
    await db.stockJournal.create({
      data: {
        reference: `SJ-${String((await db.stockJournal.count()) + 1).padStart(4, "0")}`,
        type: "PRODUCTION",
        sourceRef: "BLD-0001",
        sourceId: bld.id,
        memo: `Build completed BLD-0001: ${madeQty} x HMW-HAMPER-01 at actual cost`,
        totalPence: cv + overhead,
        createdAt: daysAgo(0),
        lines: {
          create: [
            { account: "Stock on Hand", debitPence: cv + overhead },
            { account: "Work in Progress", creditPence: cv },
            { account: "Production Overhead Absorbed", creditPence: overhead, description: "3 hours assembly labour" },
          ],
        },
      },
    });
    // a draft plan ready for the live demo
    await db.productionOrder.create({
      data: {
        reference: "BLD-0002",
        productId: hamper.id,
        warehouseId: northampton.id,
        status: "DRAFT",
        plannedQty: 40,
        notes: "Second run, start live in the demo",
        createdAt: daysAgo(0),
        lines: {
          create: bomPer.map(([sku, per]) => ({
            componentId: pid(sku),
            plannedQty: per * 40,
          })),
        },
      },
    });
  }

  const counts = {
    families: await db.productFamily.count(),
    categories: await db.category.count(),
    brands: await db.brand.count(),
    creditNotes: await db.creditNote.count(),
    users: await db.user.count(),
    suppliers: await db.supplier.count(),
    adjustments: await db.stockAdjustment.count(),
    transfers: await db.warehouseTransfer.count(),
    stockJournals: await db.stockJournal.count(),
    productionOrders: await db.productionOrder.count(),
    products: await db.product.count(),
    warehouses: await db.warehouse.count(),
    stockLevels: await db.stockLevel.count(),
    purchaseOrders: await db.purchaseOrder.count(),
    costInvoices: await db.costInvoice.count(),
    allocations: await db.costAllocation.count(),
    channels: await db.channel.count(),
    salespeople: await db.salesPerson.count(),
    customers: await db.customer.count(),
    salesOrders: await db.salesOrder.count(),
    despatches: await db.despatch.count(),
    stockMovements: await db.stockMovement.count(),
    customerReturns: await db.customerReturn.count(),
    supplierReturns: await db.supplierReturn.count(),
    customerLocations: await db.customerLocation.count(),
    reservations: await db.stockReservation.count(),
    amendments: await db.orderAmendment.count(),
    invoices: await db.invoice.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
