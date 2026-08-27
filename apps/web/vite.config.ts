import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
})
