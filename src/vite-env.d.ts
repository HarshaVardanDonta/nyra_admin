/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in dev uses Vite proxy (same-origin). Required for production builds. */
  readonly VITE_API_BASE_URL?: string
  /** e.g. `/dev` when the API uses ENVIRONMENT=dev. Empty for production API paths. */
  readonly VITE_API_PATH_PREFIX?: string
  /** Dev-only: proxy target; see vite.config.ts (prefix path or /api + /healthz). */
  readonly VITE_API_PROXY_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
