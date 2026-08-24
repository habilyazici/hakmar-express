# Hakmar Express v2

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

Default seeded login: `superadmin` / `ChangeMe123!` (change immediately —
this is a dev-only default, see `apps/api/.env`).

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
| Spatial forecast | `POST /spatial-forecast/run`, `GET /spatial-forecast/runs`, `/runs/:id` |
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

## Status

Shipped: the cross-cutting NestJS architecture (guards/interceptors/filters,
validated environment, Redis cache), Prisma schema + migrations, auth with
rotating refresh tokens and reuse detection, and the Dashboard, Charts,
Tables, KDS Analytics and Spatial Forecast modules with unit and e2e
coverage on CI.

Spatial Forecast fits one ordinary-least-squares model per city (or
region) over that area's own monthly history, using a linear trend plus
two Fourier harmonics for seasonality, and layers discount / cost /
purchasing-power scenarios on top. Areas with too little history fall
back to their mean and are labelled as such rather than presented as
fitted. Every run is recorded in `spatial_forecast_runs`, and city runs are
drawn as a choropleth of Türkiye's 81 provinces joined on licence-plate
code. See `apps/api/prisma/data/README.md` for the boundary data's source
and licence.

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
