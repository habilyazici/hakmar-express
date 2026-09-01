# Web

React + Vite + TanStack Query, in Turkish, against the API in
[`../api`](../api). The whole picture is in the [repository
README](../../README.md); this file covers what is local to this app.

## Layout

```
src/
  main.tsx App.tsx      routes, the query-client defaults, the error boundary
  components/           the shell, and the pieces every page shares:
                        QueryState, ReferenceSelect, ThemeToggle
  features/<name>/      one folder per page
    queries.ts          every request that feature makes, including its cache
                        keys — pages consume the hooks and never build a URL
  lib/                  the axios client and its refresh interceptor, number
                        and date formatting, the theme store
```

`queries.ts` owning both the URL and the cache key is the one rule worth
stating: a key that disagrees with the parameters actually sent shows stale
data on one screen and is invisible on every other, and that can only happen
where the two are written out separately.

Response shapes and every vocabulary that travels in a query string come from
`@hakmar/contracts`, which the API compiles against too — so a disagreement
between the two is a build failure rather than an empty column somebody
notices in production.

## Scripts

```bash
pnpm dev          # :5174, strictPort — see vite.config.ts for why
pnpm lint         # oxlint
pnpm typecheck
pnpm test         # vitest
pnpm build        # tsc -b && vite build
pnpm preview      # serves the real build, Content-Security-Policy included
pnpm test:smoke   # the built app in a real browser — see smoke/
pnpm test:smoke:dev   # the same walk against the Vite dev server
```

`smoke/` holds the one check in this repository that loads the application.
It starts the API and this app itself and requires every page to render.
`playwright.config.ts` explains what it is for and why the dev-server variant
is not redundant.

`VITE_API_URL` must point at the API; `.env.example` has the local value.

## Security notes

Write controls are hidden from roles that cannot use them (`useHasRole`,
mirroring the API's `@Roles()`). That is presentation, not enforcement — the
server refuses the request whatever this renders — but a button whose only
possible outcome is 403 reads as a broken screen rather than as a permission
boundary.

The access token lives in memory only and the refresh token is an httpOnly
cookie this code never sees, so there is nothing here for a script to steal.
The build adds a Content-Security-Policy with no `'unsafe-inline'` in
`script-src`, so there is nothing for an injected script to do either;
`vite.config.ts` explains the policy and what it deliberately leaves to
whatever serves the files.
