import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// Testing Library's auto-cleanup only runs when it can find a global
// afterEach, which it can here — but registering it explicitly means a test
// file that opts out of globals still gets an unmounted tree between tests.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/**
 * jsdom implements no media queries at all, and `use-color-scheme` calls
 * matchMedia at module scope — so importing anything that reaches the theme
 * store would throw before a single assertion ran.
 */
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
