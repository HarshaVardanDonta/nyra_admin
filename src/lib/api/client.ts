import { getApiBaseUrl } from '../../config/env'
import { ApiError, toApiError } from './errors'

export type RequestOptions = Omit<RequestInit, 'body' | 'headers'> & {
  body?: unknown
  token?: string | null
  headers?: HeadersInit
}

function joinUrl(base: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, headers: initHeaders, ...rest } = options
  const base = getApiBaseUrl()
  const url = joinUrl(base, path)

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
    throw toApiError(res.status, parsed, res.statusText)
  }

  if (res.status === 204 || text === '') {
    return undefined as T
  }

  return (isJson ? parsed : text) as T
}
