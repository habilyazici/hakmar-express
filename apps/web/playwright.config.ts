import { defineConfig } from '@playwright/test'

/**
 * The smoke suite: the only test that runs the actual application.
 *
 * Everything else in this repository checks the app without ever loading it.
 * That gap shipped three broken pages: `@hakmar/contracts` compiles to
 * CommonJS, Vite does not pre-bundle a linked workspace package, and the
 * named exports the Grafikler, Tablolar and Tahmin pages read at runtime
 * could not be resolved through the barrel's `__exportStar`. Every check
 * passed — the types were right, the build succeeded because Rollup resolves
 * those re-exports itself, and no test rendered any of the three. Only
 * opening the app in a browser found it.
 *
 * So this suite asserts the one thing the others structurally cannot: that
 * each page actually renders, against a real API, in a real browser.
 *
 * `.smoke.ts` rather than `.spec.ts` so vitest — which owns `*.test.ts` and
 * `*.spec.ts` in this package — does not try to run a Playwright suite.
 */

const API_PORT = Number(process.env.SMOKE_API_PORT ?? 3001)
const WEB_PORT = Number(process.env.SMOKE_WEB_PORT ?? 5174)

export default defineConfig({
  testDir: './smoke',
  testMatch: '**/*.smoke.ts',
  // One browser, one worker, no retries: a flaky pass here would defeat the
  // point. If this suite is red, the application does not run.
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Kept only for a failure, and only for the run that produced it.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  // Both servers are the built artefacts, not the dev server. The bug this
  // suite exists for was dev-only, so it has to cover the dev server too —
  // `pnpm test:smoke:dev` points it there; CI runs the build, which is what
  // actually ships.
  webServer: [
    {
      command: 'pnpm --filter api start:prod',
      url: `http://localhost:${API_PORT}/api/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { PORT: String(API_PORT) },
    },
    {
      command:
        process.env.SMOKE_TARGET === 'dev'
          ? `pnpm --filter web dev --port ${WEB_PORT} --strictPort`
          : `pnpm --filter web preview --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 90_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
