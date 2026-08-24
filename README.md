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

## Scripts (run from repo root, fan out via Turborepo)

```bash
pnpm lint
pnpm typecheck
pnpm test        # unit tests
pnpm test:e2e    # e2e tests, needs postgres+redis running
pnpm build
```

## Status

**Milestone 1** (foundational scaffold): repo structure, cross-cutting
NestJS architecture (guards/interceptors/filters), Prisma schema +
migrations, auth with rotating refresh tokens, one full vertical slice
(Dashboard Overview: API + Redis caching + React page), tests, CI.

Everything else from the legacy app (Charts & Trends, Tables & Rankings,
Spatial Forecast, KDS Analytics, Data Listing, generic DB admin tool) is
scoped for later milestones — see the Milestone 1 plan for the full
rationale and the decisions made along the way (Postgres over MySQL, Redis
over the legacy ad-hoc cache, Prisma over Sequelize, dropped the raw-SQL
admin tool in favor of Prisma Studio, completed the orphaned Subcategory
relation, dropped the unimplementable stock-based pricing rule).
