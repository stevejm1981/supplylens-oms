# SupplyLens OMS, prototype

A trimmed-down OMS that sits between the 3PL/WMS and the accounting ledger,
doing the jobs mid-market inventory platforms are kept alive for:

- **Purchase orders**, container-centric; receive into a stock location
- **Landed costs**, freight/duty/handling invoices spread across PO lines, and
  across *multiple POs sharing one container*; penny-exact (largest remainder
  method over integer pence)
- **Bundles**, virtual kits: availability derives from component stock, no
  assembly step (virtual bundles, no assembly builds)
- **Stock**, consolidated on-hand across locations, valued at average landed cost
- **Channel rules**, per-channel stock-feed pipelines (e.g. Very: ≤5 → OOS,
  else qty ÷ 4 with blank-when-OOS; Frasers: −20 buffer) with live preview and
  CSV feed download

Deliberately **not** here: sales orders, invoicing, accounting, auth,
multi-tenancy, real integrations. This is a throwaway prototype to validate the
domain model and demo the two calculation engines.

## Run it

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db
npm run seed             # container story: 2 received POs + 3 cost invoices + 4 channels
npm run dev
```

Tests (allocation exactness + channel rule semantics):

```bash
npm test
```

## Demo script

1. **Dashboard**, stock value at landed cost; follow the "two-minute tour" card.
2. **PO-0001**, freight (by weight), duty (by value) and handling (by quantity)
   spread across the lines; totals reconcile to the invoice amounts exactly.
3. **Stock / product detail**, average landed cost built from opening stock +
   received tranches, recomputed live. Attach another cost invoice to a received
   PO and watch the averages re-price (late freight bills just work).
4. **PO-0003 (draft)**, place → receive → stock and averages move.
5. **Bundles**, BBQ Starter availability is constrained by fire pits; the
   derivation table shows the min-component maths.
6. **Channels → Very**, edit a rule step and watch the live preview change;
   download the CSV feed. Bundles flow through with derived quantities.

## Architecture notes

- Next.js (App Router) + Tailwind v4 + shadcn/ui; Prisma 7 + SQLite
  (better-sqlite3 driver adapter).
- Money is **integer pence**, weight **integer grams**, allocation maths is exact
  by construction; the only fractional value anywhere is display-only landed unit
  cost.
- The two engines are pure, dependency-free functions in `src/lib/engine/`,
  `landed-cost.ts` and `channel-rules.ts` are the graduation candidates for the
  real platform.
- Average landed cost is **computed on demand, never stored**: with no outbound
  transactions, the weighted average over tranches equals a moving average, and
  late-arriving cost invoices re-price history for free.

## Deliberate punts

- Dated cost layers / period averages (needed once sales orders exist)
- Un-receiving or editing received POs (locked once received)
- Bundle-of-bundle (rejected at BOM save)
- Component reservation across bundles (shared components are double-counted in
  availability, standard virtual-bundle behaviour, noted in the UI)
- Editing cost invoices (delete and recreate instead)
