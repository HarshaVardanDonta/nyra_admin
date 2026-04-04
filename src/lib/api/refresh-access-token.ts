import { getApiBaseUrl } from '../../config/env'
import { ApiError, toApiError } from './errors'

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const base = getApiBaseUrl()
  const path = '/api/v1/auth/refresh'
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'Could not reach the server'
    throw new ApiError(`Network error: ${msg}`, 0)
  }

  const text = await res.text()
  let parsed: unknown
  if (!text) {
    parsed = undefined
  } else {
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    throw toApiError(res.status, parsed, res.statusText)
  }

  if (typeof parsed !== 'object' || parsed === null || !('token' in parsed)) {
    throw new ApiError('Invalid refresh response', res.status, parsed)
  }
  const t = (parsed as { token: unknown }).token
  if (typeof t !== 'string' || !t.trim()) {
    throw new ApiError('Invalid refresh response', res.status, parsed)
  }
  return t
}
