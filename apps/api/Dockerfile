# The API image.
#
# Built from the repository root, not from apps/api: the workspace lockfile,
# the pnpm-workspace manifest and @hakmar/contracts all live above it, and the
# API does not compile without them.
#
#   docker build -f apps/api/Dockerfile -t hakmar-api .

# bookworm-slim rather than alpine on purpose. bcrypt and Prisma's query
# engine are native; alpine is musl, where the prebuilt binaries do not apply
# and the build falls back to compiling from source — which needs a toolchain
# the image would then carry for nothing.
FROM node:24-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable

# The whole workspace in one layer. Splitting manifests from source for
# dependency caching does not work here: the API's postinstall runs
# `prisma generate`, which needs prisma/schema.prisma to already be present.
COPY . .

RUN pnpm install --frozen-lockfile \
 && pnpm --filter @hakmar/contracts build \
 && pnpm --filter api build

# `deploy` resolves the workspace links into a self-contained tree, so the
# runtime image carries neither the pnpm store nor the other workspace
# packages' sources. --prod drops the dev dependencies; --ignore-scripts stops
# it re-running the postinstall, whose prisma CLI is one of the dev
# dependencies it has just dropped. The client is already generated above and
# is copied with the rest of the package.
#
# --legacy because this workspace does not set inject-workspace-packages;
# without it pnpm 10+ refuses rather than guessing which of the two deploy
# strategies was meant.
RUN pnpm --filter api --prod --ignore-scripts --legacy deploy /out

# ---------------------------------------------------------------------------
# The migration runner.
#
# A separate image rather than something the API does on start, because the
# Prisma CLI that applies migrations is a dev dependency — the runtime image
# below deliberately does not have one. Keeping it separate also keeps schema
# changes an explicit, observable step instead of a side effect of a restart,
# which matters when more than one API replica starts at once.
#
#   docker compose -f docker-compose.prod.yml run --rm migrate
FROM build AS migrate
# Prisma links against openssl to reach Postgres, and the slim base has none.
# Without it every command still runs but warns that it cannot detect the
# libssl version and is guessing.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /repo/apps/api
# The binary directly rather than `pnpm exec`: pnpm 11 checks whether the
# installed tree still matches the lockfile before running anything, and in a
# container with no TTY that check tries an install of its own and fails
# asking for confirmation it cannot get.
#
# `migrate deploy` only plays forward the migrations committed to the
# repository. It never generates one and never resets anything.
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Prisma's query engine links against openssl at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=node:node /out ./

# The image runs unprivileged. node:24 ships this user; nothing here needs
# root, and a container that does not need it should not have it.
USER node

# The app's own default, unchanged. Behind the proxy in this repo it is never
# published — only nginx is reachable from outside.
EXPOSE 3000

# Exec form, so node is PID 1 and receives SIGTERM directly. That is what
# makes enableShutdownHooks() in main.ts fire and Prisma close its pool
# instead of the process being killed mid-query.
CMD ["node", "dist/src/main"]
