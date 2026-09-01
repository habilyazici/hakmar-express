import { expect, test, type ConsoleMessage, type Page, type Request } from '@playwright/test'

/**
 * Sign in, then visit every page and require that it rendered.
 *
 * The assertions are deliberately shallow — a heading, no thrown exception,
 * no server error. Anything deeper belongs in the unit or API e2e suites,
 * which can make it without paying for a browser. What only a browser can
 * say is whether the module graph resolves and the component tree mounts,
 * and that is the whole job here.
 */

const USERNAME = process.env.SEED_ADMIN_USERNAME ?? 'superadmin'
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'

/** Route, and the <h1> that proves that route's module rendered. */
const PAGES: [path: string, heading: string][] = [
  ['/dashboard', 'Genel Bakış'],
  ['/charts', 'Grafikler'],
  ['/tables', 'Tablolar'],
  ['/kds', 'KDS Analiz'],
  ['/forecast', 'Tahmin ve Senaryo'],
  ['/transactions', 'İşlemler'],
  ['/admin', 'Yönetim'],
  ['/users', 'Kullanıcılar'],
]

/**
 * A cold load always asks /auth/refresh before anyone has signed in, and the
 * 401 that comes back is the answer, not a fault. Everything else counts.
 */
function isExpected(text: string): boolean {
  return text.includes('/auth/refresh') || text.includes('401 (Unauthorized)')
}

function collectProblems(page: Page): string[] {
  const problems: string[] = []

  page.on('pageerror', (error: Error) => {
    problems.push(`uncaught: ${error.message}`)
  })
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!isExpected(text)) problems.push(`console: ${text}`)
  })
  page.on('response', (response) => {
    // 5xx is the app's own fault wherever it comes from. 4xx is usually the
    // test asking for something it should not, and the refresh above is
    // expected, so only server errors fail the run.
    if (response.status() >= 500) {
      problems.push(`http ${response.status()}: ${response.url()}`)
    }
  })
  page.on('requestfailed', (request: Request) => {
    const failure = request.failure()?.errorText ?? 'unknown'
    // Navigation aborts when a page is left mid-flight; not a fault.
    if (failure.includes('ERR_ABORTED')) return
    problems.push(`request failed (${failure}): ${request.url()}`)
  })

  return problems
}

test('signs in and renders every page', async ({ page }) => {
  const problems = collectProblems(page)

  await page.goto('/login')
  await page.fill('input[autocomplete="username"]', USERNAME)
  await page.fill('input[autocomplete="current-password"]', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')

  for (const [path, heading] of PAGES) {
    await page.goto(path)
    await expect(
      page.getByRole('heading', { level: 1, name: heading }),
      `${path} should render its heading — a missing one means the route's module did not load`,
    ).toBeVisible({ timeout: 30_000 })

    // The error boundary renders instead of the page when a module throws
    // during render, and it has a heading of its own, so check it directly.
    await expect(
      page.getByText('Bir şeyler ters gitti'),
      `${path} rendered the error boundary`,
    ).toHaveCount(0)
  }

  expect(problems, `page errors during the walk:\n  ${problems.join('\n  ')}`).toEqual([])
})
