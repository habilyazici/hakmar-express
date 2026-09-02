import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Separate from vite.config.ts on purpose.
 *
 * That file's CSP plugin hashes every inline script in the built page and
 * throws when index.html is missing its marker — correct for a build, and
 * nothing to do with a test run. Loading it here would put a build-time
 * assertion in the way of `pnpm test`.
 *
 * The environment is jsdom because the component tests below mount real
 * components: before them, everything under src/lib was a pure function and
 * a DOM was never needed, which is precisely why four thousand lines of TSX
 * had no test of any kind.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // The smoke suite is Playwright's; vitest owns *.test.ts(x) only.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
