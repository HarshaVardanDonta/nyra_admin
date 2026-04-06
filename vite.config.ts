import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function normalizePathPrefix(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const p = t.startsWith('/') ? t : `/${t}`
  return p.replace(/\/+$/, '') || ''
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'
  const pathPrefix = normalizePathPrefix(env.VITE_API_PATH_PREFIX)

  /**
   * When `VITE_API_PATH_PREFIX` is set (e.g. `/dev`), proxy that subtree to the backend.
   * Otherwise proxy `/api` and `/healthz` (production-style paths).
   */
  const apiProxy: Record<string, { target: string; changeOrigin: boolean }> =
    pathPrefix
      ? {
          [pathPrefix]: {
            target: proxyTarget,
            changeOrigin: true,
          },
        }
      : {
          '/api': {
            target: proxyTarget,
            changeOrigin: true,
          },
          '/healthz': {
            target: proxyTarget,
            changeOrigin: true,
          },
        }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: apiProxy,
    },
    preview: {
      proxy: apiProxy,
    },
  }
})
