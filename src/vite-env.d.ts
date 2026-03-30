/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in dev uses Vite proxy (same-origin). Required for production builds. */
  readonly VITE_API_BASE_URL?: string
  /** Dev-only: proxy target for /api and /healthz (see vite.config.ts). */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
