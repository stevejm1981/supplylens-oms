/* Shopify D2C test fixture: the SHOPIFY-ECOM customer, the Shopify channel,
   and the Equinox Kombucha can range from the real SMF, with opening stock.
   Idempotent: run any time (including after `npm run seed`, which wipes it).
   Run: npm run seed:shopify */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const { db } = await import("../src/lib/db");
const { JOURNAL_ACCOUNTS, recordStockJournal } = await import("../src/lib/journals");

const PRODUCTS = [
  { sku: "BUILD A BOX", name: "Build A Box (Cans / 24)", sellPence: 3132, basePence: 150, weightGrams: 350, opening: 100 },
  { sku: "EK-BLO-250", name: "Blood Orange Cans", sellPence: 500, basePence: 80, weightGrams: 270, opening: 200 },
  { sku: "EK-SL-250 AMB", name: "Sicilian Lemon Cans", sellPence: 500, basePence: 80, weightGrams: 270, opening: 200 },
  { sku: "EK-R&E-250 AMB", name: "Raspberry & Elderflower Cans", sellPence: 500, basePence: 80, weightGrams: 270, opening: 200 },
  { sku: "EK-P&M-250", name: "Pineapple & Mango Cans", sellPence: 500, basePence: 80, weightGrams: 270, opening: 200 },
  { sku: "EK-GIN-250 AMB", name: "Fiery Ginger Cans", sellPence: 500, basePence: 80, weightGrams: 270, opening: 200 },
];

const supplier = await db.supplier.upsert({
  where: { code: "FOL" },
  create: {
    name: "Flower of Life Ltd",
    code: "FOL",
    country: "GB",
    contactEmail: "orders@example-fol.co.uk",
    leadTimeDays: 7,
  },
  update: {},
});
console.log("supplier:", supplier.code);

const channel = await db.channel.upsert({
  where: { code: "shopify" },
  create: { name: "Shopify", code: "shopify", rulesJson: "[]" },
  update: {},
});
console.log("channel:", channel.code);

const warehouse = await db.warehouse.findFirstOrThrow({ where: { isDefault: true } });
const salesPerson = await db.salesPerson.findFirstOrThrow({ orderBy: { name: "asc" } });

const customer = await db.customer.upsert({
  where: { code: "SHOPIFY-ECOM" },
  create: {
    name: "Shopify Ecom",
    code: "SHOPIFY-ECOM",
    defaultSalesPersonId: salesPerson.id,
    defaultWarehouseId: warehouse.id,
    paymentTermsDays: 0, // paid at source (shopify_payments)
  },
  update: {},
});
console.log("customer:", customer.code, "| warehouse:", warehouse.code, "| salesperson:", salesPerson.name);

for (const p of PRODUCTS) {
  const product = await db.product.upsert({
    where: { sku: p.sku },
    create: {
      sku: p.sku,
      name: p.name,
      type: "STANDARD",
      supplierId: supplier.id,
      sellPricePence: p.sellPence,
      baseCostPence: p.basePence,
      weightGrams: p.weightGrams,
    },
    update: {},
  });
  const existing = await db.stockLevel.findUnique({
    where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
  });
  if (existing) {
    console.log(`product ${p.sku}: exists, stock untouched (${existing.quantity} on hand)`);
    continue;
  }
  await db.$transaction(async (tx) => {
    await tx.stockLevel.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: p.opening,
        openingQuantity: p.opening,
        openingUnitCostPence: p.basePence,
      },
    });
    await tx.stockMovement.create({
      data: {
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: p.opening,
        balanceAfter: p.opening,
        type: "OPENING",
        reference: "OPENING-SHOPIFY",
        notes: "Shopify D2C test fixture take-on",
      },
    });
    await recordStockJournal(tx, {
      type: "OPENING",
      sourceRef: "OPENING-SHOPIFY",
      memo: `Opening stock take-on ${p.sku} (Shopify D2C fixture)`,
      lines: [
        { account: JOURNAL_ACCOUNTS.stock, debitPence: p.opening * p.basePence },
        { account: JOURNAL_ACCOUNTS.openingBalances, creditPence: p.opening * p.basePence },
      ],
    });
  });
  console.log(`product ${p.sku}: created with ${p.opening} on hand @ ${p.basePence}p`);
}

console.log("done");
await db.$disconnect();
