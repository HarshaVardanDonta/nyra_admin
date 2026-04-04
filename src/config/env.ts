function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

/**
 * Base URL for API requests.
 * - Development: set `VITE_API_BASE_URL` to the API origin (e.g. http://localhost:8080) so
 *   the browser calls the backend directly. Leave it empty for same-origin requests; Vite
 *   then proxies `/api` and `/healthz` to `VITE_API_PROXY_TARGET` (Network tab shows the dev server).
 * - Production: set to the full public API origin (no trailing slash).
 */
export function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()

  if (import.meta.env.DEV) {
    if (!raw) return ''
    return normalizeBaseUrl(raw)
  }

  if (!raw) {
    throw new Error(
      'VITE_API_BASE_URL is not set. Configure it for production builds (see .env.example).',
    )
  }
  return normalizeBaseUrl(raw)
}
