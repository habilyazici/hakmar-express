# Hakmar Express

Ground-up rewrite of the Hakmar Express retail analytics dashboard, replacing
the legacy Express/Sequelize/MySQL app. See the audit report and Milestone 1
plan for the full rationale.

## Stack

- **API**: NestJS + Prisma + PostgreSQL
- **Web**: React + Vite + TanStack Query
- **Cache**: Redis (`@keyv/redis`)
- **Monorepo**: pnpm workspaces + Turborepo

## Prerequisites

- Node 24, pnpm (`corepack enable`)
- Docker Desktop (for local Postgres + Redis)

## Getting started

```bash
docker compose up -d                          # postgres + redis
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
pnpm --filter api exec prisma migrate dev     # creates the schema
pnpm --filter api exec prisma db seed         # creates the first superadmin
pnpm dev                                      # api on :3000, web on :5173
```

The seed creates the first superadmin from `SEED_ADMIN_USERNAME` and
`SEED_ADMIN_PASSWORD` in `apps/api/.env`. Copied straight from
`.env.example` those are `superadmin` / `ChangeMe123!` — a dev-only default
to change immediately. Changing the values and re-running the seed does not
reset an existing account: the upsert leaves it alone, so change the password
through the app or delete the row first.

`JWT_ACCESS_SECRET` must be at least 32 characters; the app validates its
whole environment at startup and refuses to boot otherwise, naming the
offending variable. Generate a real one with `openssl rand -hex 32`.

## Scripts (run from repo root, fan out via Turborepo)

```bash
pnpm lint
pnpm typecheck
pnpm test        # unit tests
pnpm test:e2e    # e2e tests, needs postgres+redis running
pnpm build
```

The e2e suites run serially (`--runInBand`): they share one database, so they
are not independent, and running them in parallel produced failures that
looked random but were one suite reading another's half-finished state.

To fill an empty database with a fictional retail history — 17 branches, 25
products, ~2,500 receipts over 25 months, enough for every page to show
something real:

```bash
pnpm --filter api seed:demo            # refuses if data already exists
pnpm --filter api seed:demo -- --force # wipe and regenerate
```

## API

All routes are under `/api/v1` and require a bearer access token. RBAC is
fail-closed: a route carrying neither `@Roles()` nor `@Public()` is denied,
so a new endpoint cannot be left unguarded by omission.

Account management is SUPERADMIN-only, and the API refuses the requests that
would make an installation unrecoverable: deactivating, demoting or deleting
your own account, or removing the last active superadmin. Password hashes are
excluded by the projection every read goes through, so one cannot reach a
response by omission. Resetting a password, deactivating an account or
changing a role revokes that user's refresh tokens — the role lives in the
access token, so this caps leftover privilege at one token lifetime rather
than for as long as the session keeps renewing.

Sessions use a short-lived access token held only in browser memory, plus a
rotating refresh token that exists solely as an httpOnly, `SameSite=Strict`
cookie scoped to `/api/v1/auth` — no part of the credential is reachable
from JavaScript. Because that cookie is the only thing the API accepts from
a cookie and every other route authenticates with a bearer header, there is
nothing for a cross-site request to abuse and no separate CSRF token is
needed. Presenting an already-rotated refresh token revokes the whole
session family.

| Area | Routes |
| --- | --- |
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/logout`, `GET /auth/profile` |
| Dashboard | `GET /dashboard/summary`, `/general-stats`, `/performance/:period`, `/daily-summary`, `/monthly-sales` |
| Charts | `GET /charts/trend`, `/ranking`, `/heatmap`, `/basket-size`, `/profit-waterfall`, `/customer-loyalty`, `/geographic-sales` |
| Tables | `GET /tables/ranking`, `/price-cost-history`, `/region-cost` |
| KDS | `GET /kds/abc-analysis`, `/demand-forecast`, `/customer-segmentation`, `/market-basket` |
| Spatial forecast | `POST /spatial-forecast/run`, `GET /spatial-forecast/runs`, `/runs/:id` (the Tahmin page's run history) |
| Catalog | `/catalog/categories`, `/subcategories`, `/brands`, `/products` — list/read/create/update/delete |
| Geo | `/geo/regions`, `/cities`, `/branches` — list/read/create/update/delete; `GET /geo/geojson/city` for the map boundaries |
| People | `/people/customers`, `/cashiers` — list/read/create/update/delete |
| Users | `/users` (SUPERADMIN only) — list/read/create/update/delete, `PATCH /users/:id/password`; `PATCH /users/me/password` for any role |
| Transactions | `GET /transactions/receipts` (paginated, filter by date range / branch / cashier / customer), `GET /transactions/receipts/:id` with its line items |

Master-data routes are read-open to every role and write-restricted to ADMIN
and above, decided per method rather than per controller. List endpoints are
paginated (`limit`, `offset`, `search`) and return `{ items, total, limit,
offset }`; which columns `search` matches is fixed by each service, never
supplied by the caller. Deleting a record something else still references
returns 409, and a duplicate key returns 409, rather than either becoming a
500.

The Charts and Tables routes replace ~51 near-identical legacy endpoints with
parameterized ones. Every parameter that reaches SQL is validated against an
enum first and then used only as a key into a lookup table of pre-written
`Prisma.Sql` fragments — user input never becomes SQL text.

## Architecture

A modular monolith: one deployable API, cut into modules that own their part
of the schema and talk to each other only through a declared surface.

```
apps/api/src/
  common/            shared kernel — guards, filters, interceptors, CRUD base,
                     the AuthenticatedUser shape. Imports no feature module.
  prisma/ cache/ config/     infrastructure. Same restriction.
  sales/             owns the receipts read model: the metric, granularity and
                     dimension vocabulary, and the SQL that expresses it
  auth/ users/ catalog/ geo/ people/ transactions/
  dashboard/ charts/ tables/ kds/ spatial-forecast/     analytics over sales/
packages/contracts/  the HTTP contract both sides compile against
```

Two rules, enforced rather than remembered (`apps/api/eslint.config.mjs`):

1. The shared kernel and the infrastructure modules may not import a feature
   module. The dependency arrow only points inwards.
2. A module reaches a neighbour through its `index.ts` and nothing else.
   Everything a neighbour is meant to use is exported there; the rest is
   private and can be changed without a search across the repo.

`eslint-plugin-boundaries` enforces both. Its elements match folders, so the
four composition-root files directly under `src/` belong to no element and
it cannot see them; they are allowed to import every module — composing them
is the job they exist to do — but a `no-restricted-imports` rule scoped to
`src/*.ts` still holds them to rule 2.

`test/` is deliberately outside all of it: the e2e suites build testing
modules out of controllers, and a controller is an HTTP entry point rather
than something a module should export to its neighbours.

Try it: import `../sales/sales.sql` instead of `../sales`, or make `common/`
import a module, and `pnpm lint` fails naming the boundary.

### The sales read model

Six modules query `receipts` and `receipt_items`. Rather than route every
aggregate through one generic builder — their query shapes genuinely differ,
and the indirection would buy nothing — `sales/sales.sql.ts` owns the
*vocabulary*: the fact join, the five metric expressions, the seven period
expressions and the seven dimension joins. Modules compose their own queries
from those fragments. A metric is named in thirty places across the six
modules — twenty-six spelled out by hand, four in the lookup tables Charts
kept privately — so renaming a column meant finding all thirty with grep,
and grep was the only thing that could: the type system cannot see inside a
template literal.

Every fragment assumes the query aliases `receipts` as `r` and
`receipt_items` as `ri`. That is the price of sharing them.

### The API/web contract

`@hakmar/contracts` holds the response shapes and the vocabularies that
travel in query strings. Both apps compile against it, so a disagreement is
a build failure rather than an empty column someone notices in production.

Every vocabulary that travels in a query string is declared as a TypeScript
enum in the API and as a string union in the contract, and asserted at
compile time to describe the same set in both directions. Add a member to one
side only and the build fails naming it and the side that is missing it. That
covers the sales metric/granularity/dimension (`sales.model.ts`), the
dashboard period, the three forecast enums, the heatmap axis pairings, the
`/tables` ranking entity and the GeoJSON document type. The last three were
the gap: two of them existed only inside the API, so the web kept its own
hand-written copy of the list — which is how a page ends up offering a
dropdown option the API answers with a 400.

`Role` is checked against two neighbours rather than one. It is a domain
concept, so `common/types/role.ts` declares it — nineteen files used to
import it from `generated/prisma`, which made a schema artefact the
definition of an idea the guards, the decorators and the DTOs are all built
on. Prisma still owns the column; that file asserts the three agree.

Where money and dates are involved the contract is parameterised over their
representation (`SummaryDto<M = string>`): the API holds a Postgres numeric
as a `Prisma.Decimal` and a date as a `Date`, and both become strings through
JSON. Pretending otherwise is what makes a shared type decorative.

Every response the web reads is covered, master data included. The nine
CRUD entities used to run through `CrudService<unknown>`: the generic base
declared its Prisma delegate as returning `unknown`, so the type argument
was decorative and `Page<unknown>` came out the other end. The delegate is
generic over the entity now, which makes assigning `prisma.city` to it a
field-by-field check the compiler performs.

Related records are optional in those DTOs on purpose — which relations come
back is decided by each service's `include` config, and the delegate's type
cannot see it. Optional is what the base class actually guarantees; required
would be a claim nothing checks.

`/tables` was the other holdout:
its four ranking queries called `$queryRaw` with no generic at all, so a
SELECT list that stopped matching what the web renders was nobody's compile
error. They carry row types now, from the same file the web reads them from.

What is deliberately not shared: the GeoJSON document inside
`/geo/geojson/city` is a JSON column the API genuinely cannot describe, so
`GeoJsonPayload<T>` leaves it `unknown` there and the map component that
draws it supplies the shape. A parameter, rather than one side asserting for
both.

### Web

`apps/web/src/features/<name>/queries.ts` owns every request that feature
makes, including its cache keys; pages consume the hooks and never build a
URL. A cache key that disagrees with the parameters actually sent shows stale
data on one screen and is invisible on every other, which is only possible
where the two are written out separately.

Write controls are hidden from roles that cannot use them (`useHasRole`,
mirroring the API's `@Roles()`). This is presentation, not enforcement — the
server refuses the request whatever the client renders — but a button whose
only possible outcome is 403 reads as a broken screen rather than as a
permission boundary.

Signing out clears the React Query cache. It is a module-level singleton that
outlives any one session and none of it is keyed by user, so without that the
next person to sign in on the same machine is served the previous account's
cached answers.

## Status

Shipped: the cross-cutting NestJS architecture (guards/interceptors/filters,
validated environment, Redis cache), Prisma schema + migrations, auth with
rotating refresh tokens and reuse detection, and the Dashboard, Charts,
Tables, KDS Analytics and Spatial Forecast modules with unit and e2e
coverage on CI.

Spatial Forecast fits one ordinary-least-squares model per city (or
region) over that area's own monthly history, using a linear trend plus
two Fourier harmonics for seasonality, and layers discount / cost /
purchasing-power scenarios on top. A discount can be aimed at one category or
product, in which case the API reads that target's real share of revenue out
of the database rather than assuming one. Areas with too little history fall
back to their mean and are labelled as such rather than presented as
fitted. Every run is recorded in `spatial_forecast_runs` and can be reloaded
from the page's history list, which redraws the numbers that run actually
produced rather than recomputing them. City runs are drawn as a choropleth of
Türkiye's 81 provinces joined on licence-plate code — which is why
`cities.plate_code` is unique: it is the join key, and two cities sharing one
would silently paint over each other. See `apps/api/prisma/data/README.md`
for the boundary data's source and licence.

Web exposes a page per module — Dashboard, Charts, Tables, KDS Analiz,
Tahmin, İşlemler, Yönetim and Kullanıcılar — behind a shared navigation
shell. Heavier
routes are lazy-loaded so the charting library stays out of the initial
bundle.

Yönetim drives all nine master-data entities from one declarative table of
resource definitions, with foreign keys rendered as dropdowns populated from
the related endpoint. That generic approach is safe on the client in a way it
would not have been on the server: the API validates every write regardless,
so a mistake in the table produces a 400 the form displays rather than an
unvalidated write.

Every feature area of the legacy application now has a replacement.

Decisions carried from the audit: Postgres over MySQL, Redis over the legacy
ad-hoc cache, Prisma over Sequelize, the raw-SQL admin tool dropped in favor
of Prisma Studio, the orphaned Subcategory relation completed, and the
unimplementable stock-based pricing rule dropped.
