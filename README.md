# Ordo

Ordo is the order management system by Supply Lens. Every order, in order:
it sits between your sales channels, your warehouse (or 3PL), and your
accounting ledger, holding the operational and financial truth for every
order from intake to invoice.

- **Sales orders** from every channel through one API intake: code-based
  resolution (customer, location, SKU, barcode, case GTIN-14), idempotent,
  held-for-review with audited amendments, back orders that cover and clear
  themselves
- **Warehouse**: Despatch Station (scan-verified pick, pack, label, confirm)
  and Goods-In Station (partial deliveries, batch and best-before capture,
  FEFO picking)
- **Purchasing**: container-centric POs, replenishment from real velocity,
  landed costs spread penny-exactly across PO lines
- **Financials**: append-only stock ledger, balanced journal outbox for the
  ledger app, average landed costing, carrier costs matched to orders for
  true margin, invoices with full line detail over the API
- **Trade portal**: invite-only buyer logins, per-customer price lists,
  ordering at live stock bands
- **Brand system**: two directions (Ledger and Signal), light and dark,
  switchable live

## Run it

```bash
npm install
# .env: DATABASE_URL (pooled), DIRECT_URL (session), OMS_API_KEY — see .env.example
npx prisma migrate deploy
npm run seed            # demo organisation and a year of trading history
npm run dev
```

Sign in with the seeded owner (see the seed output), or create an
organisation from the sign-in page. `npm run check` runs the type check and
the unit test suite; see `ROADMAP.md` for the tracked plan and `docs/help/`
for the complete help guide.
