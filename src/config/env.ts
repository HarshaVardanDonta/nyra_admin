function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}

/**
 * Base URL for API requests.
 * - Development: leave `VITE_API_BASE_URL` empty to use same-origin requests
 *   (Vite proxies `/api` and `/healthz` — avoids CORS preflight to the backend).
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
