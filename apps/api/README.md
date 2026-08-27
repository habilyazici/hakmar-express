# API

NestJS + Prisma + PostgreSQL. The whole picture — stack, ports, getting
started, the route table and the architectural rules — is in the [repository
README](../../README.md); this file covers what is local to this app.

## Layout

```
src/
  main.ts app.module.ts setup-app.ts app.controller.ts
                     the composition root: the only files allowed to import
                     every module, because composing them is their job
  common/            shared kernel — guards, filters, interceptors, the CRUD
                     base, Role, the AuthenticatedUser shape. Imports no
                     feature module, ever
  prisma/ cache/ config/
                     infrastructure. Same restriction
  sales/             the receipts read model: the metric, granularity and
                     dimension vocabulary, and the SQL that expresses it
  auth/ users/ catalog/ geo/ people/ transactions/
  dashboard/ charts/ tables/ kds/ spatial-forecast/
                     analytics, all of it composed out of sales/
  test/              e2e suites, deliberately outside the boundary rules
```

`eslint.config.mjs` enforces two things the folder names only imply: the
kernel and the infrastructure modules may not import a feature module, and a
module reaches a neighbour through its `index.ts` and nothing else. Break
either and `pnpm lint` fails naming the boundary.

## Scripts

```bash
pnpm dev              # watch mode
pnpm lint             # eslint, including the module boundaries
pnpm typecheck
pnpm test             # unit
pnpm test:e2e         # needs postgres + redis; raises the login throttle
pnpm build
```

## Database

```bash
pnpm exec prisma migrate dev     # create/apply a migration
pnpm exec prisma db seed         # first superadmin + province boundaries
pnpm exec prisma studio          # the admin tool, replacing the legacy raw-SQL one
pnpm seed:demo                   # a fictional retail history to look at
```

CI runs `prisma migrate diff --exit-code` against the schema, so a
`schema.prisma` edit that was never turned into a migration fails the build
rather than surfacing at deploy time.

## Environment

`src/config/env.validation.ts` is the boot-time contract: the app validates
its whole environment at startup and refuses to start otherwise, naming the
variable at fault. `.env.example` documents every one of them, including the
three per-IP rate limits and the reverse-proxy and cookie settings a
deployment has to set.
