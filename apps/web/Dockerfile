# The web image: build the app, then serve it with nginx.
#
# Built from the repository root, like the API image — @hakmar/contracts and
# the workspace lockfile live above apps/web.
#
#   docker build -f apps/web/Dockerfile -t hakmar-web .

FROM node:24-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile

# Relative, because nginx serves this app and the API under one origin. It is
# baked in at build time — Vite substitutes it into the bundle, so it is a
# property of the image rather than something the container can be told later.
# It also decides the Content-Security-Policy the build writes into
# index.html: a relative URL needs no extra connect-src origin, since 'self'
# already covers it.
ENV VITE_API_URL=/api/v1
RUN pnpm --filter @hakmar/contracts build \
 && pnpm --filter web build

FROM nginx:1.31-alpine AS runtime
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf

# 8080, not 80: the container needs no privileged port, so it does not get one.
EXPOSE 8080
