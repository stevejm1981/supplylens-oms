/* Sainsbury's EDI test fixture: the SAINSBURYS customer (GLN-keyed Langlands
   Park depot), the sainsburys-as2 channel, and the All Things Butter range
   incl. two SKUs the Morrisons fixture does not carry. Self-contained and
   idempotent: products shared with the Morrisons fixture upsert harmlessly.
   Run: npm run seed:sainsburys */
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
  { sku: "ATB-CC-NAT-240", name: "All Things Cottage Cheese Natural 240g", sellPence: 115, basePence: 69, weightGrams: 240, unitsPerCase: 12, caseGtin: "15061051740149", opening: 400 },
  { sku: "ATB-CC-LF-240", name: "All Things Cottage Cheese Low Fat Natural 240g", sellPence: 115, basePence: 69, weightGrams: 240, unitsPerCase: 12, caseGtin: "15061051740200", opening: 300 },
  { sku: "ATB-CC-SMOOTH-240", name: "All Things Cottage Cheese Smooth 240g", sellPence: 111, basePence: 67, weightGrams: 240, unitsPerCase: 12, caseGtin: "15061051740224", opening: 150 },
  { sku: "ATB-CC-NAT-450", name: "All Things Cottage Cheese Natural 450g", sellPence: 181, basePence: 109, weightGrams: 450, unitsPerCase: 6, caseGtin: "15061051740156", opening: 120 },
];

const channel = await db.channel.upsert({
  where: { code: "sainsburys-as2" },
  create: { name: "Sainsburys EDI", code: "sainsburys-as2", rulesJson: "[]" },
  update: {},
});
console.log("channel:", channel.code);

const warehouse = await db.warehouse.findFirstOrThrow({ where: { isDefault: true } });
const salesPerson = await db.salesPerson.findFirstOrThrow({ orderBy: { name: "asc" } });

const customer = await db.customer.upsert({
  where: { code: "SAINSBURYS" },
  create: {
    name: "J Sainsbury Plc",
    code: "SAINSBURYS",
    defaultSalesPersonId: salesPerson.id,
    defaultWarehouseId: warehouse.id,
    paymentTermsDays: 30,
    deliveryAddress: "33 Holborn\nLondon EC1N 2HT\nUnited Kingdom",
  },
  update: {},
});
await db.customerLocation.upsert({
  where: { customerId_code: { customerId: customer.id, code: "5010011090751" } },
  create: {
    customerId: customer.id,
    code: "5010011090751", // the depot GLN from the EDI ship-to
    name: "Langlands Pk (075)",
    address: "Hurlawcrook Road\nLanglands Business Park\nE Kilbride G75 0QH\nUnited Kingdom",
    isDefault: true,
  },
  update: {},
});
console.log("customer:", customer.code, "| depot location: 5010011090751 (GLN)");

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
      barcode: p.caseGtin,
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
        reference: "OPENING-SAINSBURYS",
        notes: "Sainsburys EDI test fixture take-on",
      },
    });
    await recordStockJournal(tx, {
      type: "OPENING",
      sourceRef: "OPENING-SAINSBURYS",
      memo: `Opening stock take-on ${p.sku} (Sainsburys EDI fixture)`,
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
