import { getApiBaseUrl } from '../config/env'

/** Resolve product media URLs for same-origin or absolute API base. */
export function resolveMediaUrl(url: string): string {
  const u = url.trim()
  if (!u) return ''
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  const base = getApiBaseUrl()
  const path = u.startsWith('/') ? u : `/${u}`
  if (!base) return path
  return `${base}${path}`
}
