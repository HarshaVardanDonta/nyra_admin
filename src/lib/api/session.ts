import {
  REFRESH_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from '../../contexts/auth-context'
import { refreshAccessToken } from './refresh-access-token'

let accessTokenListener: ((token: string | null) => void) | null = null

let refreshPromise: Promise<string | null> | null = null

export function setAccessTokenListener(cb: ((token: string | null) => void) | null) {
  accessTokenListener = cb
}

function readRefreshTokenFromStorage(): string | null {
  try {
    const v = localStorage.getItem(REFRESH_STORAGE_KEY)
    return v?.trim() ? v : null
  } catch {
    return null
  }
}

export function persistLoginSession(accessToken: string, refreshToken: string) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
    localStorage.setItem(REFRESH_STORAGE_KEY, refreshToken)
  } catch {
    /* ignore */
  }
  accessTokenListener?.(accessToken)
}

export function persistAccessToken(accessToken: string) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
  } catch {
    /* ignore */
  }
  accessTokenListener?.(accessToken)
}

export function clearAuthStorage() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(REFRESH_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  accessTokenListener?.(null)
}

/**
 * Refreshes the access token using the stored refresh token.
 * Concurrent callers share one in-flight refresh.
 */
export function refreshSession(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise
  }
  const rt = readRefreshTokenFromStorage()
  if (!rt) {
    return Promise.resolve(null)
  }
  refreshPromise = (async () => {
    try {
      const newAccess = await refreshAccessToken(rt)
      persistAccessToken(newAccess)
      return newAccess
    } catch {
      clearAuthStorage()
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}
