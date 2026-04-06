import { buildApiUrl } from '../../config/env'
import {
  ApiError,
  isInvalidAccessTokenResponse,
  toApiError,
} from './errors'
import { refreshSession } from './session'

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown
  token?: string | null
  headers?: HeadersInit
  /** When true, 401 invalid token will not trigger refresh (avoids recursion on auth endpoints). */
  skipAuthRefresh?: boolean
}

async function requestInner<T>(
  path: string,
  options: RequestOptions,
  authRetried: boolean,
): Promise<T> {
  const {
    body,
    token,
    headers: initHeaders,
    skipAuthRefresh,
    ...rest
  } = options
  const url = buildApiUrl(path)

  const headers = new Headers(initHeaders)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not reach the server'
    throw new ApiError(`Network error: ${msg}`, 0)
  }

  const contentType = res.headers.get('Content-Type') ?? ''
  const isJson = contentType.includes('application/json')
  const text = await res.text()
  let parsed: unknown
  if (!text) {
    parsed = undefined
  } else if (isJson) {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      parsed = text
    }
  } else {
    parsed = text
  }

  if (!res.ok) {
    if (
      !skipAuthRefresh &&
      !authRetried &&
      token &&
      isInvalidAccessTokenResponse(res.status, parsed)
    ) {
      const newToken = await refreshSession()
      if (newToken) {
        return requestInner<T>(
          path,
          { ...options, token: newToken },
          true,
        )
      }
    }
    throw toApiError(res.status, parsed, res.statusText)
  }

  if (res.status === 204 || text === '') {
    return undefined as T
  }

  return (isJson ? parsed : text) as T
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return requestInner<T>(path, options, false)
}

export type AuthorizedFetchInit = {
  method?: string
  headers?: HeadersInit
  token?: string | null
  skipAuthRefresh?: boolean
}

/**
 * GET (or other) fetch that retries once after refreshing the access token on 401 invalid token.
 * Returns the successful `Response` (caller reads body).
 */
export async function fetchWithAuthRetry(
  path: string,
  init: AuthorizedFetchInit = {},
  authRetried = false,
): Promise<Response> {
  const { method = 'GET', headers: initHeaders, token, skipAuthRefresh } =
    init
  const url = buildApiUrl(path)
  const headers = new Headers(initHeaders)
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res: Response
  try {
    res = await fetch(url, { method, headers })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not reach the server'
    throw new ApiError(`Network error: ${msg}`, 0)
  }

  if (res.ok) {
    return res
  }

  const contentType = res.headers.get('Content-Type') ?? ''
  const isJson = contentType.includes('application/json')
  const text = await res.text()
  let parsed: unknown
  if (!text) {
    parsed = undefined
  } else if (isJson) {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      parsed = text
    }
  } else {
    parsed = text
  }

  if (
    !skipAuthRefresh &&
    !authRetried &&
    token &&
    isInvalidAccessTokenResponse(res.status, parsed)
  ) {
    const newToken = await refreshSession()
    if (newToken) {
      return fetchWithAuthRetry(
        path,
        { ...init, token: newToken },
        true,
      )
    }
  }

  throw toApiError(res.status, parsed, res.statusText)
}
