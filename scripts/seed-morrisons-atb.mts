/* Morrisons EDI test fixture: the MORRISONS customer (60-day terms) with the
   Sittingbourne Fresh depot as a GLN-keyed delivery location, the Morrisons
   AS2 channel, and the All Things Butter range: each-unit products with
   case pack units carrying the GTIN-14s the EDI orders by. Opening stock
   included. Idempotent: run any time (including after `npm run seed`).
   Run: npm run seed:morrisons */
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
  { sku: "ATB-BUTTER-200", name: "All Things Butter Salted 200g", sellPence: 188, basePence: 112, weightGrams: 200, unitsPerCase: 16, caseGtin: "15061051740071", opening: 400 },
  { sku: "ATB-CC-MANGO-240", name: "All Things Cottage Cheese Mango 240g", sellPence: 124, basePence: 74, weightGrams: 240, unitsPerCase: 12, caseGtin: "15061051740163", opening: 150 },
  { sku: "ATB-CC-NAT-240", name: "All Things Cottage Cheese Natural 240g", sellPence: 115, basePence: 69, weightGrams: 240, unitsPerCase: 12, caseGtin: "15061051740149", opening: 400 },
  { sku: "ATB-CC-LF-240", name: "All Things Cottage Cheese Low Fat Natural 240g", sellPence: 115, basePence: 69, weightGrams: 240, unitsPerCase: 12, caseGtin: "15061051740200", opening: 300 },
];

const channel = await db.channel.upsert({
  where: { code: "morrisons-as2" },
  create: { name: "Morrisons EDI", code: "morrisons-as2", rulesJson: "[]" },
  update: {},
});
console.log("channel:", channel.code);

const warehouse = await db.warehouse.findFirstOrThrow({ where: { isDefault: true } });
const salesPerson = await db.salesPerson.findFirstOrThrow({ orderBy: { name: "asc" } });

const customer = await db.customer.upsert({
  where: { code: "MORRISONS" },
  create: {
    name: "WM Morrison Supermarkets Limited",
    code: "MORRISONS",
    defaultSalesPersonId: salesPerson.id,
    defaultWarehouseId: warehouse.id,
    paymentTermsDays: 60, // "60 DAYS DISCOUNT 0%" per the EDI order note
    deliveryAddress: {
      company: "Wm Morrison Supermarkets",
      line1: "Hilmore House",
      line2: "Gain Lane",
      city: "Bradford",
      province: "West Yorkshire",
      postcode: "BD3 7DL",
      country: "United Kingdom",
    },
  },
  update: {},
});
await db.customerLocation.upsert({
  where: { customerId_code: { customerId: customer.id, code: "5010251007630" } },
  create: {
    customerId: customer.id,
    code: "5010251007630", // the depot GLN, exactly what the EDI ship-to carries
    name: "SITTINGBOURNE FRESH",
    address: {
      name: "Goods In",
      company: "Morrisons RDC Sittingbourne",
      line1: "G-PARK",
      line2: "FLEET END",
      city: "SITTINGBOURNE",
      province: "Kent",
      postcode: "ME10 2FD",
      country: "United Kingdom",
    },
    isDefault: true,
  },
  update: {},
});
console.log("customer:", customer.code, "| depot location: 5010251007630 (GLN)");

for (const p of PRODUCTS) {
  const product = await db.product.upsert({
    where: { sku: p.sku },
    create: {
      sku: p.sku,
      name: p.name,
      type: "STANDARD",
      sellPricePence: p.sellPence,
      baseCostPence: p.basePence,
      weightGrams: p.weightGrams,
    },
    update: {},
  });
  await db.productUom.upsert({
    where: { productId_code: { productId: product.id, code: `CASE${p.unitsPerCase}` } },
    create: {
      productId: product.id,
      code: `CASE${p.unitsPerCase}`,
      name: `Case of ${p.unitsPerCase}`,
      unitsPerUom: p.unitsPerCase,
      barcode: p.caseGtin, // GTIN-14: EDI lines resolve product AND unit from it
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
        reference: "OPENING-MORRISONS",
        notes: "Morrisons EDI test fixture take-on",
      },
    });
    await recordStockJournal(tx, {
      type: "OPENING",
      sourceRef: "OPENING-MORRISONS",
      memo: `Opening stock take-on ${p.sku} (Morrisons EDI fixture)`,
      lines: [
        { account: JOURNAL_ACCOUNTS.stock, debitPence: p.opening * p.basePence },
        { account: JOURNAL_ACCOUNTS.openingBalances, creditPence: p.opening * p.basePence },
      ],
    });
  });
  console.log(`product ${p.sku}: created, case GTIN ${p.caseGtin}, ${p.opening} on hand`);
}

console.log("done");
await db.$disconnect();
