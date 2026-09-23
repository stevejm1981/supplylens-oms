@AGENTS.md

# Project conventions

## Definition of Done — every feature, no exceptions

1. **Tests first-class**: every new pure function/engine gets unit tests in a
   sibling `*.test.ts`; every touched engine's edge cases get covered. DB-bound
   flows are verified with throwaway tsx scripts until the integration harness
   exists (see ROADMAP.md).
2. **`npm run check` green** (`tsc --noEmit && vitest run`) before a feature is
   called done. A feature that breaks an existing test is not done.
3. **ROADMAP.md updated** — move the item to Shipped; add anything newly
   discovered to Next/Later. Nothing gets built that isn't on the roadmap first.
4. **University updated** — the training guide (scratchpad HTML → Artifact) must
   describe every module as it currently behaves, AND its Roadmap swimlane
   section must mirror ROADMAP.md.
5. **Stage, never commit** — `git add -A` at the end; commits only when Steve
   asks.

## House rules

- Money = integer pence, weight = integer grams; totals from allocated pence,
  never floats. Largest-remainder for splits.
- Stock only moves inside transactions that also write the movement ledger
  (`recordMovement`) and, when value moves, the stock journal
  (`recordStockJournal`). Same transaction, always.
- Statuses are canonical codes (the API contract); Settings only renames
  display labels. Never branch logic on a label.
- Base units (eaches) are the stock truth; pack/uom conversion happens at the
  document line via its `unitsPerUom` snapshot.
- Document references come from `nextRef()` (settings-aware); never hardcode
  prefixes outside the seed.
- Copy style: Oxford punctuation, and never an en dash or em dash anywhere a
  user can read (UI strings, University, README, roadmap, API descriptions).
  Use commas, colons, or parentheses instead. No third-party inventory-platform
  brand names in customer-facing materials.
- Never Intl-format dates in SSR'd client components — format server-side and
  pass strings (hydration).
- The dev server holds a stale Prisma client after `prisma generate` —
  restart it (`pkill -f "next dev"`) after schema changes.
- `prisma migrate dev` blocks non-interactively on warnings — hand-author the
  migration folder and use `prisma migrate deploy`.
