// Onboarding import/export. One spec per entity defines the CSV columns,
// the export query and the import logic, so the export IS the import
// template and the two can never drift apart.
//
// Import contract (the same everywhere):
//   • Rows upsert by the natural key (code / sku / name), re-importing a
//     file is idempotent, and an export → edit → import round-trip is the
//     supported way to bulk-edit.
//   • EVERY row is validated first; any error anywhere → nothing is applied
//     and all problems come back with their row numbers (one fix pass).
//   • On updates, an empty cell means "leave unchanged" (PATCH semantics);
//     required columns must always be filled.

import { db } from "@/lib/db";
import { parseCsv, toCsv } from "@/lib/csv";
import { parsePoundsToPence } from "@/lib/money";
import { recordMovement } from "@/lib/stock-ledger";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export interface ColumnDoc {
  name: string;
  required?: boolean;
  maps: string; // where the value lands
  notes?: string;
}

export interface ImportOutcome {
  ok: boolean;
  created: number;
  updated: number;
  errors: string[];
}

export interface EntitySpec {
  key: string; // URL slug
  title: string;
  description: string; // one-liner for the Data page
  naturalKey: string; // human description of the upsert key
  columns: ColumnDoc[];
  exportRows(): Promise<string[][]>;
  /** rows are header-keyed, cells trimmed; rowNo is 1-based data row for errors */
  importRows(
    tx: Tx,
    rows: { rowNo: number; cells: Record<string, string> }[],
    errors: string[],
  ): Promise<{ created: number; updated: number }>;
}

// ── cell helpers ────────────────────────────────────────────────────────────

const up = (s: string) => s.trim().toUpperCase();
const orNull = (s: string) => (s.trim() === "" ? null : s.trim());
/** blank → undefined (leave unchanged on update) */
const orSkip = (s: string) => (s.trim() === "" ? undefined : s.trim());

function parseBoolCell(s: string): boolean | undefined | null {
  const v = s.trim().toUpperCase();
  if (v === "") return undefined;
  if (["TRUE", "YES", "1", "Y"].includes(v)) return true;
  if (["FALSE", "NO", "0", "N"].includes(v)) return false;
  return null; // invalid
}

function parseIntCell(s: string): number | undefined | null {
  if (s.trim() === "") return undefined;
  const n = Number(s.trim());
  return Number.isInteger(n) ? n : null;
}

function poundsCell(s: string): number | undefined | null {
  if (s.trim() === "") return undefined;
  return parsePoundsToPence(s.trim());
}

const pounds = (pence: number) => (pence / 100).toFixed(2);
const boolCsv = (b: boolean) => (b ? "TRUE" : "FALSE");

// ── entity specs, in recommended import order ───────────────────────────────

export const ENTITIES: EntitySpec[] = [
  {
    key: "salespeople",
    title: "Salespeople",
    description: "Import these first, customers reference them by name.",
    naturalKey: "name",
    columns: [
      { name: "name", required: true, maps: "SalesPerson.name", notes: "Upsert key, exact match" },
      { name: "email", maps: "SalesPerson.email" },
    ],
    async exportRows() {
      const rows = await db.salesPerson.findMany({ orderBy: { name: "asc" } });
      return rows.map((s) => [s.name, s.email ?? ""]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      const existing = new Map(
        (await tx.salesPerson.findMany()).map((s) => [s.name.toLowerCase(), s]),
      );
      for (const { rowNo, cells } of rows) {
        const name = cells.name?.trim();
        if (!name) {
          errors.push(`row ${rowNo}: name is required`);
          continue;
        }
        const found = existing.get(name.toLowerCase());
        if (found) {
          await tx.salesPerson.update({
            where: { id: found.id },
            data: { email: orSkip(cells.email ?? "") },
          });
          updated++;
        } else {
          const s = await tx.salesPerson.create({
            data: { name, email: orNull(cells.email ?? "") },
          });
          existing.set(name.toLowerCase(), s);
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "warehouses",
    title: "Warehouses",
    description: "Physical locations. One should be the default.",
    naturalKey: "code",
    columns: [
      { name: "code", required: true, maps: "Warehouse.code", notes: "Upsert key, uppercased" },
      { name: "name", required: true, maps: "Warehouse.name" },
      { name: "isDefault", maps: "Warehouse.isDefault", notes: "TRUE/FALSE, at most one TRUE" },
      { name: "notes", maps: "Warehouse.notes" },
    ],
    async exportRows() {
      const rows = await db.warehouse.findMany({ orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
      return rows.map((w) => [w.code, w.name, boolCsv(w.isDefault), w.notes ?? ""]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      let sawDefault = false;
      for (const { rowNo, cells } of rows) {
        const code = up(cells.code ?? "");
        const name = cells.name?.trim();
        if (!code || !name) {
          errors.push(`row ${rowNo}: code and name are required`);
          continue;
        }
        const isDefault = parseBoolCell(cells.isDefault ?? "");
        if (isDefault === null) {
          errors.push(`row ${rowNo}: isDefault must be TRUE or FALSE`);
          continue;
        }
        if (isDefault) {
          if (sawDefault) {
            errors.push(`row ${rowNo}: only one warehouse can be the default`);
            continue;
          }
          sawDefault = true;
          await tx.warehouse.updateMany({ data: { isDefault: false } });
        }
        const found = await tx.warehouse.findUnique({ where: { code } });
        if (found) {
          await tx.warehouse.update({
            where: { id: found.id },
            data: { name, isDefault: isDefault ?? undefined, notes: orSkip(cells.notes ?? "") },
          });
          updated++;
        } else {
          await tx.warehouse.create({
            data: { code, name, isDefault: isDefault ?? false, notes: orNull(cells.notes ?? "") },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "suppliers",
    title: "Suppliers",
    description: "Import before products, products reference supplierCode.",
    naturalKey: "code",
    columns: [
      { name: "code", required: true, maps: "Supplier.code", notes: "Upsert key, uppercased" },
      { name: "name", required: true, maps: "Supplier.name" },
      { name: "country", required: true, maps: "Supplier.country", notes: 'e.g. "CN", "GB"' },
      { name: "contactEmail", maps: "Supplier.contactEmail" },
      { name: "leadTimeDays", maps: "Supplier.leadTimeDays", notes: "Whole days" },
      { name: "notes", maps: "Supplier.notes" },
    ],
    async exportRows() {
      const rows = await db.supplier.findMany({ orderBy: { code: "asc" } });
      return rows.map((s) => [
        s.code,
        s.name,
        s.country,
        s.contactEmail ?? "",
        s.leadTimeDays != null ? String(s.leadTimeDays) : "",
        s.notes ?? "",
      ]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      for (const { rowNo, cells } of rows) {
        const code = up(cells.code ?? "");
        const name = cells.name?.trim();
        const country = cells.country?.trim();
        if (!code || !name || !country) {
          errors.push(`row ${rowNo}: code, name and country are required`);
          continue;
        }
        const lead = parseIntCell(cells.leadTimeDays ?? "");
        if (lead === null) {
          errors.push(`row ${rowNo}: leadTimeDays must be a whole number`);
          continue;
        }
        const data = {
          name,
          country,
          contactEmail: orSkip(cells.contactEmail ?? ""),
          leadTimeDays: lead,
          notes: orSkip(cells.notes ?? ""),
        };
        const found = await tx.supplier.findUnique({ where: { code } });
        if (found) {
          await tx.supplier.update({ where: { id: found.id }, data });
          updated++;
        } else {
          await tx.supplier.create({
            data: {
              code,
              name,
              country,
              contactEmail: orNull(cells.contactEmail ?? ""),
              leadTimeDays: lead ?? null,
              notes: orNull(cells.notes ?? ""),
            },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "customers",
    title: "Customers",
    description: "References salespeople by name (auto-created if new) and warehouses by code.",
    naturalKey: "code",
    columns: [
      { name: "code", required: true, maps: "Customer.code", notes: "Upsert key, uppercased, also the API sync key" },
      { name: "name", required: true, maps: "Customer.name" },
      { name: "email", maps: "Customer.email" },
      { name: "phone", maps: "Customer.phone" },
      { name: "paymentTermsDays", maps: "Customer.paymentTermsDays", notes: "Whole days; default 30" },
      { name: "deliveryAddress", maps: "Customer.deliveryAddress", notes: "Multi-line OK when quoted" },
      { name: "defaultSalesPerson", maps: "Customer.defaultSalesPersonId", notes: "Salesperson NAME, created if missing" },
      { name: "defaultWarehouseCode", maps: "Customer.defaultWarehouseId", notes: "Must exist, import warehouses first" },
      { name: "notes", maps: "Customer.notes" },
    ],
    async exportRows() {
      const rows = await db.customer.findMany({
        orderBy: { code: "asc" },
        include: { defaultSalesPerson: true, defaultWarehouse: true },
      });
      return rows.map((c) => [
        c.code,
        c.name,
        c.email ?? "",
        c.phone ?? "",
        String(c.paymentTermsDays),
        c.deliveryAddress ?? "",
        c.defaultSalesPerson?.name ?? "",
        c.defaultWarehouse?.code ?? "",
        c.notes ?? "",
      ]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      const salesByName = new Map(
        (await tx.salesPerson.findMany()).map((s) => [s.name.toLowerCase(), s.id]),
      );
      const whByCode = new Map((await tx.warehouse.findMany()).map((w) => [w.code, w.id]));
      for (const { rowNo, cells } of rows) {
        const code = up(cells.code ?? "");
        const name = cells.name?.trim();
        if (!code || !name) {
          errors.push(`row ${rowNo}: code and name are required`);
          continue;
        }
        const terms = parseIntCell(cells.paymentTermsDays ?? "");
        if (terms === null || (terms !== undefined && terms < 0)) {
          errors.push(`row ${rowNo}: paymentTermsDays must be a whole number ≥ 0`);
          continue;
        }
        let salesPersonId: string | undefined;
        const spName = cells.defaultSalesPerson?.trim();
        if (spName) {
          salesPersonId = salesByName.get(spName.toLowerCase());
          if (!salesPersonId) {
            const s = await tx.salesPerson.create({ data: { name: spName } });
            salesByName.set(spName.toLowerCase(), s.id);
            salesPersonId = s.id;
          }
        }
        let warehouseId: string | undefined;
        const whCode = up(cells.defaultWarehouseCode ?? "");
        if (whCode) {
          warehouseId = whByCode.get(whCode);
          if (!warehouseId) {
            errors.push(`row ${rowNo}: unknown defaultWarehouseCode "${whCode}", import warehouses first`);
            continue;
          }
        }
        const patch = {
          name,
          email: orSkip(cells.email ?? ""),
          phone: orSkip(cells.phone ?? ""),
          paymentTermsDays: terms,
          deliveryAddress: orSkip(cells.deliveryAddress ?? ""),
          defaultSalesPersonId: salesPersonId,
          defaultWarehouseId: warehouseId,
          notes: orSkip(cells.notes ?? ""),
        };
        const found = await tx.customer.findUnique({ where: { code } });
        if (found) {
          await tx.customer.update({ where: { id: found.id }, data: patch });
          updated++;
        } else {
          await tx.customer.create({
            data: {
              code,
              name,
              email: orNull(cells.email ?? ""),
              phone: orNull(cells.phone ?? ""),
              paymentTermsDays: terms ?? 30,
              deliveryAddress: orNull(cells.deliveryAddress ?? ""),
              defaultSalesPersonId: salesPersonId ?? null,
              defaultWarehouseId: warehouseId ?? null,
              notes: orNull(cells.notes ?? ""),
            },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "customer-locations",
    title: "Customer delivery locations",
    description: "The named per-customer addresses API orders auto-assign by code.",
    naturalKey: "customerCode + code",
    columns: [
      { name: "customerCode", required: true, maps: "Customer.code", notes: "Must exist, import customers first" },
      { name: "code", required: true, maps: "CustomerLocation.code", notes: "Upsert key within the customer; the API sync key" },
      { name: "name", required: true, maps: "CustomerLocation.name" },
      { name: "address", required: true, maps: "CustomerLocation.address", notes: "Multi-line OK when quoted" },
      { name: "contact", maps: "CustomerLocation.contact" },
      { name: "isDefault", maps: "CustomerLocation.isDefault", notes: "TRUE/FALSE, at most one per customer" },
    ],
    async exportRows() {
      const rows = await db.customerLocation.findMany({
        orderBy: [{ customer: { code: "asc" } }, { code: "asc" }],
        include: { customer: { select: { code: true } } },
      });
      return rows.map((l) => [
        l.customer.code,
        l.code,
        l.name,
        l.address,
        l.contact ?? "",
        boolCsv(l.isDefault),
      ]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      const customers = new Map((await tx.customer.findMany()).map((c) => [c.code, c.id]));
      const defaulted = new Set<string>();
      for (const { rowNo, cells } of rows) {
        const customerCode = up(cells.customerCode ?? "");
        const code = up(cells.code ?? "").replace(/\s+/g, "-");
        const name = cells.name?.trim();
        const address = cells.address?.trim();
        if (!customerCode || !code || !name || !address) {
          errors.push(`row ${rowNo}: customerCode, code, name and address are required`);
          continue;
        }
        const customerId = customers.get(customerCode);
        if (!customerId) {
          errors.push(`row ${rowNo}: unknown customerCode "${customerCode}", import customers first`);
          continue;
        }
        const isDefault = parseBoolCell(cells.isDefault ?? "");
        if (isDefault === null) {
          errors.push(`row ${rowNo}: isDefault must be TRUE or FALSE`);
          continue;
        }
        if (isDefault) {
          if (defaulted.has(customerCode)) {
            errors.push(`row ${rowNo}: ${customerCode} already has a default location in this file`);
            continue;
          }
          defaulted.add(customerCode);
          await tx.customerLocation.updateMany({
            where: { customerId },
            data: { isDefault: false },
          });
        }
        const found = await tx.customerLocation.findUnique({
          where: { customerId_code: { customerId, code } },
        });
        if (found) {
          await tx.customerLocation.update({
            where: { id: found.id },
            data: {
              name,
              address,
              contact: orSkip(cells.contact ?? ""),
              isDefault: isDefault ?? undefined,
            },
          });
          updated++;
        } else {
          await tx.customerLocation.create({
            data: {
              customerId,
              code,
              name,
              address,
              contact: orNull(cells.contact ?? ""),
              isDefault: isDefault ?? false,
            },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "products",
    title: "Products",
    description: "Families, categories and brands auto-create by code; suppliers must exist.",
    naturalKey: "sku",
    columns: [
      { name: "sku", required: true, maps: "Product.sku", notes: "Upsert key, uppercased" },
      { name: "name", required: true, maps: "Product.name" },
      { name: "type", maps: "Product.type", notes: "STANDARD (default), BUNDLE (virtual), or ASSEMBLED (manufactured), BOMs via the bom-lines import" },
      { name: "barcode", maps: "Product.barcode", notes: "EAN/GTIN, unique across the catalogue" },
      { name: "weightGrams", maps: "Product.weightGrams", notes: "Whole grams; drives weight-based cost allocation" },
      { name: "baseCostPounds", maps: "Product.baseCostPence", notes: "e.g. 1.85, stored as integer pence" },
      { name: "sellPricePounds", maps: "Product.sellPricePence", notes: "e.g. 7.99" },
      { name: "supplierCode", maps: "Product.supplierId", notes: "Must exist, import suppliers first" },
      { name: "familyCode", maps: "Product.familyId", notes: "Auto-created if new" },
      { name: "variant", maps: "Product.variant", notes: 'Label within the family, e.g. "Grey"' },
      { name: "categoryCode", maps: "Product.categoryId", notes: "Auto-created if new" },
      { name: "brandCode", maps: "Product.brandId", notes: "Auto-created if new" },
      { name: "recipeMakes", maps: "Product.bomOutputQty", notes: "ASSEMBLED only: units one batch of the BOM produces (default 1)" },
    ],
    async exportRows() {
      const rows = await db.product.findMany({
        orderBy: { sku: "asc" },
        include: { supplier: true, family: true, category: true, brand: true },
      });
      return rows.map((p) => [
        p.sku,
        p.name,
        p.type,
        p.barcode ?? "",
        String(p.weightGrams),
        pounds(p.baseCostPence),
        pounds(p.sellPricePence),
        p.supplier?.code ?? "",
        p.family?.code ?? "",
        p.variant ?? "",
        p.category?.code ?? "",
        p.brand?.code ?? "",
        p.type === "ASSEMBLED" ? String(p.bomOutputQty) : "",
      ]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      const suppliers = new Map((await tx.supplier.findMany()).map((s) => [s.code, s.id]));
      const families = new Map((await tx.productFamily.findMany()).map((f) => [f.code, f.id]));
      const categories = new Map((await tx.category.findMany()).map((c) => [c.code, c.id]));
      const brands = new Map((await tx.brand.findMany()).map((b) => [b.code, b.id]));
      const groupId = async (
        kind: "family" | "category" | "brand",
        cell: string,
      ): Promise<string | undefined> => {
        const code = up(cell);
        if (!code) return undefined;
        const cache = kind === "family" ? families : kind === "category" ? categories : brands;
        const hit = cache.get(code);
        if (hit) return hit;
        const data = { code, name: cell.trim() };
        const row =
          kind === "family"
            ? await tx.productFamily.create({ data })
            : kind === "category"
              ? await tx.category.create({ data })
              : await tx.brand.create({ data });
        cache.set(code, row.id);
        return row.id;
      };
      for (const { rowNo, cells } of rows) {
        const sku = up(cells.sku ?? "");
        const name = cells.name?.trim();
        if (!sku || !name) {
          errors.push(`row ${rowNo}: sku and name are required`);
          continue;
        }
        const type = up(cells.type ?? "") || undefined;
        if (type && !["STANDARD", "BUNDLE", "ASSEMBLED"].includes(type)) {
          errors.push(`row ${rowNo}: type must be STANDARD, BUNDLE, or ASSEMBLED`);
          continue;
        }
        const weight = parseIntCell(cells.weightGrams ?? "");
        const baseCost = poundsCell(cells.baseCostPounds ?? "");
        const sellPrice = poundsCell(cells.sellPricePounds ?? "");
        if (weight === null || baseCost === null || sellPrice === null) {
          errors.push(`row ${rowNo}: weightGrams must be whole grams; prices like 7.99`);
          continue;
        }
        let supplierId: string | undefined;
        const supplierCode = up(cells.supplierCode ?? "");
        if (supplierCode) {
          supplierId = suppliers.get(supplierCode);
          if (!supplierId) {
            errors.push(`row ${rowNo}: unknown supplierCode "${supplierCode}", import suppliers first`);
            continue;
          }
        }
        const recipeMakes = parseIntCell(cells.recipeMakes ?? "");
        if (recipeMakes === null || (recipeMakes !== undefined && recipeMakes < 1)) {
          errors.push(`row ${rowNo}: recipeMakes must be a whole number of at least 1`);
          continue;
        }
        const familyId = await groupId("family", cells.familyCode ?? "");
        const categoryId = await groupId("category", cells.categoryCode ?? "");
        const brandId = await groupId("brand", cells.brandCode ?? "");
        const patch = {
          name,
          type,
          barcode: orSkip(cells.barcode ?? ""),
          weightGrams: weight,
          baseCostPence: baseCost,
          sellPricePence: sellPrice,
          supplierId,
          familyId,
          variant: orSkip(cells.variant ?? ""),
          categoryId,
          brandId,
          bomOutputQty: recipeMakes,
        };
        const found = await tx.product.findUnique({ where: { sku } });
        if (found) {
          await tx.product.update({ where: { id: found.id }, data: patch });
          updated++;
        } else {
          await tx.product.create({
            data: {
              sku,
              name,
              type: type ?? "STANDARD",
              barcode: orNull(cells.barcode ?? ""),
              weightGrams: weight ?? 0,
              baseCostPence: baseCost ?? 0,
              sellPricePence: sellPrice ?? 0,
              supplierId: supplierId ?? null,
              familyId: familyId ?? null,
              variant: orNull(cells.variant ?? ""),
              categoryId: categoryId ?? null,
              brandId: brandId ?? null,
              bomOutputQty: recipeMakes ?? 1,
            },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "pack-configurations",
    title: "Pack configurations",
    description: "Alternate selling units with their outer/case GTINs.",
    naturalKey: "sku + code",
    columns: [
      { name: "sku", required: true, maps: "Product.sku", notes: "Must exist, import products first" },
      { name: "code", required: true, maps: "ProductUom.code", notes: 'Upsert key within the product, e.g. "PACK6"' },
      { name: "name", required: true, maps: "ProductUom.name", notes: '"Pack of 6"' },
      { name: "unitsPerUom", required: true, maps: "ProductUom.unitsPerUom", notes: "Base units per pack, whole number ≥ 2" },
      { name: "barcode", maps: "ProductUom.barcode", notes: "Outer/case GTIN, API orders resolve product AND unit from it" },
    ],
    async exportRows() {
      const rows = await db.productUom.findMany({
        orderBy: [{ product: { sku: "asc" } }, { unitsPerUom: "asc" }],
        include: { product: { select: { sku: true } } },
      });
      return rows.map((u) => [
        u.product.sku,
        u.code,
        u.name,
        String(u.unitsPerUom),
        u.barcode ?? "",
      ]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      const products = new Map(
        (await tx.product.findMany()).map((p) => [p.sku, { id: p.id, type: p.type }]),
      );
      for (const { rowNo, cells } of rows) {
        const sku = up(cells.sku ?? "");
        const code = up(cells.code ?? "").replace(/\s+/g, "-");
        const name = cells.name?.trim();
        const units = parseIntCell(cells.unitsPerUom ?? "");
        if (!sku || !code || !name || units === undefined) {
          errors.push(`row ${rowNo}: sku, code, name and unitsPerUom are required`);
          continue;
        }
        if (units === null || units < 2) {
          errors.push(`row ${rowNo}: unitsPerUom must be a whole number ≥ 2`);
          continue;
        }
        const product = products.get(sku);
        if (!product) {
          errors.push(`row ${rowNo}: unknown sku "${sku}", import products first`);
          continue;
        }
        if (product.type === "BUNDLE") {
          errors.push(`row ${rowNo}: ${sku} is a bundle, pack units apply to standard products`);
          continue;
        }
        const barcode = orNull(cells.barcode ?? "");
        const found = await tx.productUom.findUnique({
          where: { productId_code: { productId: product.id, code } },
        });
        if (found) {
          await tx.productUom.update({
            where: { id: found.id },
            data: { name, unitsPerUom: units, barcode: barcode ?? found.barcode },
          });
          updated++;
        } else {
          await tx.productUom.create({
            data: { productId: product.id, code, name, unitsPerUom: units, barcode },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "bom-lines",
    title: "Bundle BOMs",
    description: "Component lines for BUNDLE products.",
    naturalKey: "bundleSku + componentSku",
    columns: [
      { name: "bundleSku", required: true, maps: "BomLine.bundleId", notes: "Must be a BUNDLE product" },
      { name: "componentSku", required: true, maps: "BomLine.componentId", notes: "Must be a STANDARD product" },
      { name: "quantity", required: true, maps: "BomLine.quantity", notes: "Components per one bundle" },
    ],
    async exportRows() {
      const rows = await db.bomLine.findMany({
        orderBy: [{ bundle: { sku: "asc" } }, { component: { sku: "asc" } }],
        include: {
          bundle: { select: { sku: true } },
          component: { select: { sku: true } },
        },
      });
      return rows.map((b) => [b.bundle.sku, b.component.sku, String(b.quantity)]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      let updated = 0;
      const products = new Map(
        (await tx.product.findMany()).map((p) => [p.sku, { id: p.id, type: p.type }]),
      );
      for (const { rowNo, cells } of rows) {
        const bundleSku = up(cells.bundleSku ?? "");
        const componentSku = up(cells.componentSku ?? "");
        const qty = parseIntCell(cells.quantity ?? "");
        if (!bundleSku || !componentSku || qty === undefined) {
          errors.push(`row ${rowNo}: bundleSku, componentSku and quantity are required`);
          continue;
        }
        if (qty === null || qty < 1) {
          errors.push(`row ${rowNo}: quantity must be a whole number ≥ 1`);
          continue;
        }
        const bundle = products.get(bundleSku);
        const component = products.get(componentSku);
        if (!bundle || (bundle.type !== "BUNDLE" && bundle.type !== "ASSEMBLED")) {
          errors.push(`row ${rowNo}: "${bundleSku}" is not a BUNDLE or ASSEMBLED product`);
          continue;
        }
        if (!component || component.type !== "STANDARD") {
          errors.push(`row ${rowNo}: "${componentSku}" is not a STANDARD product`);
          continue;
        }
        const found = await tx.bomLine.findUnique({
          where: { bundleId_componentId: { bundleId: bundle.id, componentId: component.id } },
        });
        if (found) {
          await tx.bomLine.update({ where: { id: found.id }, data: { quantity: qty } });
          updated++;
        } else {
          await tx.bomLine.create({
            data: { bundleId: bundle.id, componentId: component.id, quantity: qty },
          });
          created++;
        }
      }
      return { created, updated };
    },
  },
  {
    key: "opening-stock",
    title: "Opening stock",
    description: "Initial balances at landed cost, import LAST, once per product/warehouse.",
    naturalKey: "sku + warehouseCode (create-only)",
    columns: [
      { name: "sku", required: true, maps: "StockLevel.productId", notes: "STANDARD products only" },
      { name: "warehouseCode", required: true, maps: "StockLevel.warehouseId", notes: "Must exist" },
      { name: "quantity", required: true, maps: "StockLevel.quantity + openingQuantity", notes: "Whole units ≥ 0" },
      {
        name: "unitCostPounds",
        required: true,
        maps: "StockLevel.openingUnitCostPence",
        notes: "Landed cost per unit, feeds the average-cost engine",
      },
    ],
    async exportRows() {
      const rows = await db.stockLevel.findMany({
        orderBy: [{ product: { sku: "asc" } }],
        include: {
          product: { select: { sku: true } },
          warehouse: { select: { code: true } },
        },
      });
      return rows.map((l) => [
        l.product.sku,
        l.warehouse.code,
        String(l.openingQuantity),
        pounds(l.openingUnitCostPence),
      ]);
    },
    async importRows(tx, rows, errors) {
      let created = 0;
      const products = new Map(
        (await tx.product.findMany()).map((p) => [p.sku, { id: p.id, type: p.type }]),
      );
      const warehouses = new Map((await tx.warehouse.findMany()).map((w) => [w.code, w.id]));
      for (const { rowNo, cells } of rows) {
        const sku = up(cells.sku ?? "");
        const whCode = up(cells.warehouseCode ?? "");
        const qty = parseIntCell(cells.quantity ?? "");
        const cost = poundsCell(cells.unitCostPounds ?? "");
        if (!sku || !whCode || qty === undefined || cost === undefined) {
          errors.push(`row ${rowNo}: sku, warehouseCode, quantity and unitCostPounds are required`);
          continue;
        }
        if (qty === null || qty < 0 || cost === null) {
          errors.push(`row ${rowNo}: quantity must be whole units ≥ 0; cost like 2.45`);
          continue;
        }
        const product = products.get(sku);
        if (!product) {
          errors.push(`row ${rowNo}: unknown sku "${sku}", import products first`);
          continue;
        }
        if (product.type === "BUNDLE") {
          errors.push(`row ${rowNo}: ${sku} is a bundle, bundles hold no physical stock`);
          continue;
        }
        const warehouseId = warehouses.get(whCode);
        if (!warehouseId) {
          errors.push(`row ${rowNo}: unknown warehouseCode "${whCode}", import warehouses first`);
          continue;
        }
        const existing = await tx.stockLevel.findUnique({
          where: { productId_warehouseId: { productId: product.id, warehouseId } },
        });
        if (existing) {
          errors.push(
            `row ${rowNo}: ${sku} @ ${whCode} already has stock, opening balances load once; use an adjustment for corrections`,
          );
          continue;
        }
        await tx.stockLevel.create({
          data: {
            productId: product.id,
            warehouseId,
            quantity: qty,
            openingQuantity: qty,
            openingUnitCostPence: cost,
          },
        });
        await recordMovement(tx, {
          productId: product.id,
          warehouseId,
          quantity: qty,
          type: "OPENING",
          reference: "IMPORT",
        });
        created++;
      }
      return { created, updated: 0 };
    },
  },
];

export const entityByKey = (key: string) => ENTITIES.find((e) => e.key === key);

export async function exportEntityCsv(key: string, templateOnly: boolean): Promise<string | null> {
  const spec = entityByKey(key);
  if (!spec) return null;
  const header = spec.columns.map((c) => c.name);
  const rows = templateOnly ? [] : await spec.exportRows();
  return toCsv([header, ...rows]);
}

export async function importEntityCsv(key: string, csvText: string): Promise<ImportOutcome> {
  const spec = entityByKey(key);
  if (!spec) return { ok: false, created: 0, updated: 0, errors: ["unknown entity"] };
  const parsed = parseCsv(csvText);
  if (parsed.length === 0) {
    return { ok: false, created: 0, updated: 0, errors: ["file is empty"] };
  }
  const header = parsed[0].map((h) => h.trim());
  const known = new Set(spec.columns.map((c) => c.name));
  const unknown = header.filter((h) => !known.has(h));
  const missing = spec.columns.filter((c) => c.required && !header.includes(c.name));
  const errors: string[] = [];
  if (unknown.length > 0) errors.push(`unknown column(s): ${unknown.join(", ")}`);
  if (missing.length > 0) {
    errors.push(`missing required column(s): ${missing.map((c) => c.name).join(", ")}`);
  }
  if (errors.length > 0) return { ok: false, created: 0, updated: 0, errors };
  if (parsed.length === 1) {
    return { ok: false, created: 0, updated: 0, errors: ["no data rows, header only"] };
  }

  const rows = parsed.slice(1).map((cells, i) => ({
    rowNo: i + 1,
    cells: Object.fromEntries(header.map((h, col) => [h, cells[col] ?? ""])),
  }));

  // Everything or nothing: any validation error rolls the whole file back so
  // a half-imported catalogue can never exist.
  try {
    const outcome = await db.$transaction(
      async (tx) => {
        const result = await spec.importRows(tx, rows, errors);
        if (errors.length > 0) throw new Error("__validation__");
        return result;
      },
      { timeout: 60_000 },
    );
    return { ok: true, ...outcome, errors: [] };
  } catch (e) {
    if (e instanceof Error && e.message === "__validation__") {
      return { ok: false, created: 0, updated: 0, errors };
    }
    return {
      ok: false,
      created: 0,
      updated: 0,
      errors: [e instanceof Error ? e.message : "import failed"],
    };
  }
}
