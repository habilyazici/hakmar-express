import { createHash } from 'node:crypto'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The Content-Security-Policy the built app is served with.
 *
 * The audit's fifth critical finding against the legacy app was "XSS plus a
 * JWT in localStorage plus no CSP": any injection became full session theft.
 * Two thirds of that are already gone — the access token lives in memory and
 * the refresh token is an httpOnly cookie no script can read — but the third
 * was still open, and the two mitigations are about what an injection can
 * *steal*, not about what it can *run* or where it can *send* things.
 *
 * `script-src` carries no 'unsafe-inline': every inline script in the built
 * page is hashed below, so an injected one does not execute at all. That is
 * the directive doing real work here. The rest closes the exfiltration paths
 * an injection would otherwise still have — a remote script, an image beacon,
 * a form post, a fetch to somebody else's host.
 *
 * `style-src` does allow 'unsafe-inline', deliberately: the app styles the
 * heatmap cells and the choropleth with computed `style` props, and there is
 * no meaningful way to hash those. An inline style is a far weaker vector
 * than an inline script, and giving that one up to keep the script rule
 * strict is the right trade.
 *
 * Applied to the build only. Vite's dev server needs its HMR websocket and
 * its own inline preamble, which a policy this strict would refuse, and a dev
 * server is not a thing that gets deployed. `pnpm preview` serves the real
 * build, so the policy can be exercised.
 *
 * Two directives cannot come from a <meta> tag at all — browsers ignore
 * `frame-ancestors` and `report-uri` there — so clickjacking protection and
 * HSTS still have to be set as real headers by whatever serves these files.
 */
function contentSecurityPolicy(apiOrigin: string, scriptHashes: string[]) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' ${scriptHashes.join(' ')}`,
    // 'self' covers the ordinary deployment, where the API is reverse-proxied
    // under the same origin. The explicit origin is what makes local
    // development work, where it is a different port on localhost.
    `connect-src 'self' ${apiOrigin}`,
  ].join('; ')
}

/** The comment in index.html that the built policy replaces. */
const CSP_MARKER = '<!-- content-security-policy -->'

/**
 * Hashes every inline script the finished page contains and writes the policy
 * into index.html in place of its marker.
 *
 * Hashing rather than listing keeps this working on its own: the theme script
 * in index.html need not be the only inline script in a build — Vite's
 * module-preload polyfill is another, when it is emitted — and nothing here
 * has to remember them. `enforce: 'post'` is what puts this after Vite's own
 * HTML transforms, so everything it needs to hash is already on the page.
 *
 * Substituting the marker rather than injecting a tag is what puts the policy
 * after the charset declaration and before the first script. Vite can only
 * prepend to <head> or append to it, and neither is that position.
 */
function cspPlugin(apiOrigin: string): Plugin {
  return {
    name: 'hakmar-csp',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      const hashes: string[] = []
      for (const [, body] of html.matchAll(
        /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi,
      )) {
        const digest = createHash('sha256')
          .update(body, 'utf8')
          .digest('base64')
        hashes.push(`'sha256-${digest}'`)
      }

      if (!html.includes(CSP_MARKER)) {
        // Louder than shipping an unprotected page: someone editing
        // index.html should not be able to drop the policy by accident.
        throw new Error(
          `index.html is missing the ${CSP_MARKER} marker, so no Content-Security-Policy could be written into it.`,
        )
      }

      const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(apiOrigin, hashes)}" />`
      return html.replace(CSP_MARKER, meta)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The same fallback apps/web/src/lib/api-client.ts uses, for the same
  // reason: without it a missing VITE_API_URL would put a policy on the page
  // that forbids talking to the API the app is about to talk to.
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const apiOrigin = new URL(
    env.VITE_API_URL || 'http://localhost:3001/api/v1',
  ).origin

  return {
    plugins: [react(), cspPlugin(apiOrigin)],
    server: {
      // 5174, not Vite's default 5173. Anyone with a second Vite project has
      // 5173, and the failure is quiet: Vite picks the next free port on its
      // own, the app comes up looking fine, and every request then fails CORS
      // because WEB_ORIGIN on the API still names the port it did not get.
      port: Number(process.env.WEB_PORT ?? 5174),
      // Fail loudly instead of drifting, for that same reason: the API is
      // configured against this exact origin, so silently landing somewhere
      // else trades a clear error for a confusing one.
      strictPort: true,
    },
  }
})
