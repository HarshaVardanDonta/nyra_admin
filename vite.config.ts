import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:8080'

  /** Forwards /api and /healthz to the Nyra backend (default :8080). Must match `server` and `preview` or `vite preview` will 404 on API calls. */
  const apiProxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
    },
    '/healthz': {
      target: proxyTarget,
      changeOrigin: true,
    },
  } as const

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
