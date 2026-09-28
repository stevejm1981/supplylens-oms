# Ordo architecture review

A technical review for engineering leadership: what is built, how data
changes, how supportable it is for a C# team, and what a move to C# would
actually involve. Every number in this document was measured against the
repository on 28 September 2026; nothing is estimated except where
labelled as an estimate.

## Executive summary

Ordo is an order management system: 61 database models, 32 REST API
endpoints, 89 server-side mutation functions, roughly 35,800 lines of
TypeScript, and 145 automated tests, live in production on a shared
Postgres database.

Three claims, defended below with evidence:

1. **The architecture is conventional and deliberately boring.** One web
   framework, one ORM, one relational database, server-rendered pages,
   REST for integrations. No microservices, no queues, no exotica.
2. **Every database change passes through one narrow, transactional
   gate.** There is exactly one database client in the application, all
   writes are server-side (nothing client-side touches the database), and
   the two dangerous write paths (stock and money) are typed so they
   cannot be called outside a transaction.
3. **The valuable logic is framework-free and portable.** The business
   rules live in small pure functions with no framework imports and a
   test for every behaviour. Porting them to C# is mechanical, and the
   two stable interfaces (a plain Postgres schema and a documented
   OpenAPI contract) mean a C# backend can be introduced incrementally,
   without a big-bang rewrite and without touching the data.

## 1. The stack, plainly

| Layer | Technology | Nearest .NET equivalent |
|---|---|---|
| UI components | React 19 (server and client components), Tailwind CSS 4, shadcn/ui | Razor components / Blazor |
| Pages and routing | Next.js 16 App Router (file-system routing, server-rendered) | ASP.NET Core MVC views + routing |
| UI mutations | Next.js server actions ("use server" functions) | Controller actions (POST handlers) |
| Integration API | Next.js route handlers under /api/v1 | ASP.NET Core Web API controllers / minimal APIs |
| ORM | Prisma 7 (schema file, generated typed client, SQL migrations) | Entity Framework Core (model + migrations) |
| Database | Postgres (hosted on Supabase; plain SQL, no vendor extensions in the schema) | The same Postgres, unchanged |
| Auth | Hand-rolled sessions (scrypt passwords, opaque tokens, httpOnly cookies) + hashed API bearer tokens | ASP.NET Core Identity-style cookie auth + API keys |
| Tests | Vitest (unit tests on pure functions) | xUnit |
| Hosting | Vercel (build: prisma generate, migrate deploy, next build) | Azure App Service / containers (see section 6) |
| Language | TypeScript 5, strict mode | C# (both statically typed, both async/await) |

Runtime dependencies: 17, and most are UI widgets (icons, dialogs, a
toast library, the Swagger viewer). The load-bearing ones are Next,
React, and Prisma. There is no dependency sprawl to audit.

Two facts worth stating early because they remove common fears:

- **Nothing in the application code is Vercel-specific.** A
  case-insensitive search for "vercel" across the source finds zero
  references in code (only prose mentions in the roadmap). The Next.js
  config contains a body-size limit and a cache header, nothing else.
  Next.js self-hosts on any Node server or container, including Azure.
- **Nothing in the database is Prisma-specific.** The schema is plain
  Postgres tables, keys, and indexes (plus Prisma's own migrations
  bookkeeping table). Entity Framework Core can scaffold a working model
  from this database, as it stands, in an afternoon.

## 2. How data changes: the mutation surfaces

There are exactly three ways data changes, and all three are server-side
code paths through a single database client (src/lib/db.ts, the only
place a client is constructed; 124 files import it, none construct their
own).

1. **Staff UI: server actions.** Every button in the app calls a
   server action: a plain async function marked "use server" that runs
   on the server, validates input, writes through the ORM, and returns
   `{ ok }` or `{ ok: false, error }`. There are 89 of these across 23
   files, one file per module (sales orders, purchasing, returns, and so
   on). The browser never talks to the database; it invokes these
   functions over POST, exactly as a form posting to a C# controller
   action would. There is no client-side data layer, no GraphQL, and no
   query language in the browser.
2. **Integrations: the REST API.** 32 endpoints under /api/v1 behind
   bearer-token auth (per-integration tokens stored as SHA-256 hashes,
   revocable, every call logged). Reads dominate; exactly 9 endpoints
   mutate (order intake, order patch, despatch confirmations, goods
   receipts, carrier invoices, invoice-paid and journal-posted and
   receipt-billed acknowledgements). Mutating endpoints are idempotent
   by external reference, so integrations can safely retry. The whole
   contract is hand-authored OpenAPI 3.1 served at /api/v1/openapi.json
   with a Swagger UI, which is also the specification a C# port would
   implement.
3. **The trade portal: buyer actions.** The B2B portal has its own,
   fully separate auth (separate models, separate cookie) and a small
   set of server actions that ultimately call the same internal
   functions the staff UI uses (a portal order goes through the same
   createSalesOrder as a staff order).

### The transactional gate

The invariant that keeps the books trustworthy: **stock and value never
move outside a database transaction that also writes the audit trail.**
Concretely:

- `recordMovement` (the append-only stock ledger) and
  `recordStockJournal` (balanced debit/credit accounting journals) both
  take a transaction handle as their first parameter. The type system
  makes it impossible to call them outside a transaction.
- `recordStockJournal` throws if debits do not equal credits, so an
  unbalanced journal cannot be written at all.
- There are 32 transaction blocks in the codebase, one per business
  event (receive a delivery, despatch an order, complete a build, match
  a carrier invoice, and so on). One event = one transaction = stock
  level + ledger row + journal, atomically.

A worked example, despatching an order: one transaction deducts stock
(bundles exploded, pack units converted), writes a ledger row per
product with its running balance, snapshots cost of goods at average
landed cost onto the order lines, writes the balanced despatch journal
(Dr Cost of Goods Sold / Cr Stock on Hand), accrues expected carriage if
given (Dr Cost to Serve / Cr Carriage Accruals), and updates the
despatch document. If any step fails, nothing happened.

Alongside the gate sits the second house rule: **derived, never
stored.** Availability, fulfilment state, back orders, payment status,
carriage status, and plan usage are computed from the underlying rows on
every read. There are no cached counters to drift out of sync, which
eliminates the classic class of "the number on screen is wrong" support
incidents at the cost of slightly more work per read (fine at this
scale, indexed where it matters).

## 3. The layering that makes it portable

The code separates into three layers with very different portability
profiles:

**Pure engines (src/lib/engine, 12 files, 876 lines).** The business
maths: penny-exact money allocation (largest-remainder), landed cost
spreading, average costing, customer pricing, FEFO batch allocation,
replenishment (velocity, reorder points), derived back orders, bundle
stock derivation, channel feed rules, carriage accrual and variance,
carrier rate cards, production build costing. These import nothing from
any framework: they are functions from values to values. Every one has
a sibling test file; the suite is 145 tests and runs in under a second.
**This layer is the product's intellectual property, and it would port
to C# almost line-for-line**, with the tests translated first as the
acceptance criteria.

**Domain services and actions (roughly 5,700 lines).** The server
actions and API routes: validate, resolve codes to records, open the
transaction, call the engines, write through the ORM. This is exactly
the shape of a C# service + controller layer, and reads like one.

**Presentation (roughly 24,000 lines).** Pages, tables, dialogs, print
documents. This is the bulk of the line count, and it is worth being
precise about what it is: React markup and form wiring. It contains no
business rules by design. Any stack, including a .NET one, needs an
equivalent amount of UI code; this layer is not a liability of the
Node choice, it is the cost of having a product.

Money is integer pence everywhere (no floats near currency), weights are
integer grams, and totals come from allocation functions that are
tested to sum exactly. In C# these become long or decimal with the same
algorithms.

## 4. Supportability for a C# team, today

**The language gap is smaller than it looks.** TypeScript in strict mode
is a statically typed, compiled-checked language with async/await,
generics, and interfaces; a C# developer reads 90% of this codebase
without instruction. Array methods (map, filter, reduce) are LINQ by
another name. The ORM usage (typed query builder, include for joins,
transactions via a callback) is structurally identical to EF Core.

**Where the genuinely unfamiliar knowledge lives, and how it is fenced.**
The Next-specific concepts are: server/client component boundaries,
cache revalidation after writes (one call, revalidatePath), and the
rule that dates are formatted server-side to avoid hydration mismatches.
All three live in the presentation layer only. The engines have none of
it; the actions touch it in exactly one place (the revalidate call at
the end). The project's CLAUDE.md records these conventions explicitly
so any maintainer (human or AI) inherits them.

**The documentation surface.** Support is rarely archaeology here:

- OpenAPI 3.1 contract (712 lines, hand-authored) + live Swagger UI.
- Ordo University: a complete operator's guide, also exported as 40
  markdown files in docs/help, including the Financials Map (every
  transaction type, its journal, and its ledger-app treatment).
- ROADMAP.md: every shipped version and everything planned, in order.
- 12 SQL migration files: the full, replayable schema history.
- An idempotent seed that builds a working demo company from empty.
- The 145-test suite as an executable specification of the maths.

**What a support incident looks like.** A wrong number on screen is a
derived-value bug: read the one query that derives it (no caches to
chase). A wrong stock or money figure has an audit trail by
construction: the ledger shows every movement with running balances,
and journals are balanced or they could not have been written. An
integration failure is visible in the API request log and reproducible
via Swagger with the same payload. None of these require deep Next.js
knowledge; they require reading typed functions and SQL data, which is
home ground for a C# engineer.

**On the AI-reliance fear, stated honestly.** The build has been
AI-accelerated, and that is a genuine dependency to manage, the same way
a contractor-built system would be. The mitigations are structural, not
aspirational: the stack is the most common web stack in industry (the
hiring pool for Next/TypeScript is very large), the conventions are
written down, the behaviour is pinned by tests, and, decisively, the
exit path below is always open because the data layer is plain Postgres
and the contract is OpenAPI. AI dependence is a bridge, not a lock-in.

## 5. The C# question, answered concretely

The two interfaces that matter are stable and portable: the **Postgres
database** (EF Core scaffolds it as-is) and the **OpenAPI contract**
(tooling such as NSwag generates C# controller stubs and clients from
it). That makes an incremental move possible, which is the only kind
worth doing.

**Option A: keep, and integrate from C#.** No port. C# services (the
existing SupplyLens platform is already C#) consume /api/v1 like any
other integration. Cost: zero. This is the current state and it works;
the API was designed for exactly this.

**Option B: strangler port of the backend (the recommended route if the
concern persists).** Stand up an ASP.NET Core Web API against the SAME
database:

1. Scaffold the EF Core model from the live Postgres schema (days).
2. Port the 12 engines and their 145 tests, tests first (the tests are
   the spec; the engines are 876 lines of framework-free functions).
   Estimate: one to two weeks for a C#-fluent pair.
3. Implement the /api/v1 contract endpoint-by-endpoint from the OpenAPI
   document, mutating endpoints first (there are only 9). Run both
   backends side by side against the same database; integrations move
   over by changing a base URL. Estimate: three to five weeks.
4. Migrate the staff UI's writes from server actions to the C# API
   (the actions already have controller shape; the React pages remain
   and just call HTTP instead). This is the long tail and can proceed
   module by module. Estimate: four to eight weeks across the 23 action
   files, prioritised by module.

Total order-of-magnitude: **two to four engineer-months for a C# team**,
incremental throughout, no data migration at any point, no big-bang
cutover, hosting on Azure App Service or containers from step 3 onward.
These are estimates and should be re-planned per module, but the shape
is low-risk because both backends can run simultaneously against one
database.

**Option C: full .NET including the UI.** Everything in B, plus
rebuilding roughly 24,000 lines of presentation in Blazor or similar.
Only worth it if the team also does not want to own React; the React
layer contains no business logic and can equally be kept as a pure
frontend on the C# API.

**On hosting.** Vercel is a convenience, not a dependency: the code has
no Vercel API usage, and Next self-hosts on Node or in a container. The
one serverless-specific limitation (runtime image uploads write to a
read-only filesystem) is already on the roadmap to move to object
storage, and disappears entirely under Options B/C.

## 6. Risk register

| Risk | Assessment | Mitigation in place |
|---|---|---|
| Team cannot support Node/Next | Real but narrower than feared: unfamiliarity is fenced into the presentation layer; engines and actions read like C# | Conventions documented (CLAUDE.md), 145 tests, large hiring pool, Option B exit always open |
| Reliance on AI for changes | Genuine today, structurally mitigated | Docs, tests, OpenAPI, migration history; the codebase is reviewable by any TypeScript developer |
| Vendor lock-in: Vercel | None found in code (verified by search) | Self-host Next anywhere; Options B/C remove it entirely |
| Vendor lock-in: Prisma | None in the data: plain Postgres | EF Core database-first scaffold works against the live schema |
| Vendor lock-in: Supabase | Postgres with standard connection strings | Any managed Postgres is a connection-string change |
| Financial correctness | Strongest part of the system | Integer pence, balanced-or-throw journals, append-only ledger, transactional gate, penny-exact tests |
| Single-organisation data scoping | The true gap before commercial multi-tenant onboarding | Already item one on the roadmap; identity, roles, invites, and API tokens exist |
| Key-person/process knowledge | Standard for any young codebase | University + Financials Map document the business behaviour, not just the code |

## The one-paragraph answer

Ordo is a conventional server-rendered web application: TypeScript on
Node with React, one ORM, one Postgres database, every write
server-side through a single client, and the dangerous writes forced
through balanced, audited transactions by the type system. The business
logic a C# team would care about is 876 lines of pure, fully tested
functions that port mechanically; the database and the API contract are
the stable interfaces a C# backend would implement; and both backends
can run side by side against the same data, so the move to C#, if
chosen, is an incremental two-to-four month strangler migration, not a
rewrite. The AI dependency is real today and is managed the way any
contractor dependency is managed: written conventions, executable
tests, complete documentation, and an exit that stays open.
