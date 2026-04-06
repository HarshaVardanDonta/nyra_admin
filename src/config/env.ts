function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

/** Normalizes VITE_API_PATH_PREFIX (e.g. `/dev`); empty if unset. */
function normalizePathPrefix(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return ''
  const p = t.startsWith('/') ? t : `/${t}`
  return p.replace(/\/+$/, '') || ''
}

/**
 * Base URL for API requests (origin + optional path prefix).
 * - Set `VITE_API_PATH_PREFIX=/dev` when the backend runs with `ENVIRONMENT=dev` (routes under `/dev`).
 * - Development (direct): `VITE_API_BASE_URL=http://localhost:8080` and optional prefix → e.g. `http://localhost:8080/dev`.
 * - Development (proxy): leave `VITE_API_BASE_URL` empty; Vite proxies the prefix path (or `/api` + `/healthz` when prefix is empty) to `VITE_API_PROXY_TARGET`.
 * - Production: `VITE_API_BASE_URL` is required (no trailing slash); prefix is usually empty.
 */
export function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  const prefix = normalizePathPrefix(
    import.meta.env.VITE_API_PATH_PREFIX as string | undefined,
  )

  let origin = ''
  if (import.meta.env.DEV) {
    if (raw) origin = normalizeBaseUrl(raw)
  } else {
    if (!raw) {
      throw new Error(
        'VITE_API_BASE_URL is not set. Configure it for production builds (see .env.example).',
      )
    }
    origin = normalizeBaseUrl(raw)
  }

  if (!prefix) return origin
  if (!origin) return prefix
  return `${origin}${prefix}`
}

/** Absolute or same-origin URL for an API path (must start with `/api` or `/healthz` for app routes). */
export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
