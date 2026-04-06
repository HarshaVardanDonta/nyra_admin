/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in dev uses Vite proxy (same-origin). Required for production builds. */
  readonly VITE_API_BASE_URL?: string
  /** Optional subpath before `/api`… (empty when API is at origin). */
  readonly VITE_API_PATH_PREFIX?: string
  /** Dev-only: proxy target; see vite.config.ts (prefix path or /api + /healthz). */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
