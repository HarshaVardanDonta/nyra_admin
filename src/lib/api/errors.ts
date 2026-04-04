export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function messageFromBody(body: unknown): string | null {
  if (body === null || body === undefined) return null
  if (typeof body === 'string') return body.trim() ? body : null
  if (typeof body !== 'object') return String(body)
  const o = body as Record<string, unknown>

  const nestedErr = o.error
  if (nestedErr !== null && typeof nestedErr === 'object') {
    const e = nestedErr as Record<string, unknown>
    const nm = e.message
    if (typeof nm === 'string' && nm.trim()) return nm
    const code = e.code
    if (typeof code === 'string' && code.trim()) return code
  }

  const m = o.message ?? o.detail
  if (typeof m === 'string') return m.trim() ? m : null
  if (Array.isArray(m) && typeof m[0] === 'string') return m.join(', ')
  return null
}

export function toApiError(status: number, body: unknown, statusText?: string): ApiError {
  const fromBody = messageFromBody(body)
  const st = statusText?.trim()
  const message =
    (fromBody && fromBody.trim()) ||
    (st ? `${status} ${st}` : '') ||
    `Request failed (${status})`
  return new ApiError(message, status, body)
}

/** Matches backend 401 when the bearer access JWT is expired or invalid. */
export function isInvalidAccessTokenResponse(
  status: number,
  body: unknown,
): boolean {
  if (status !== 401) return false
  if (body === null || typeof body !== 'object') return false
  const err = (body as { error?: { code?: string; message?: string } }).error
  return (
    err?.code === 'UNAUTHORIZED' && err?.message === 'invalid token'
  )
}

/** Clearer copy for order status DELETE failures (403 / 409). */
export function orderStatusDeleteUserMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return getErrorMessage(err)
  const raw = err.message?.trim() || `Request failed (${err.status})`
  let code: string | undefined
  if (err.body !== null && err.body !== undefined && typeof err.body === 'object') {
    const e = (err.body as { error?: { code?: string } }).error
    code = e?.code
  }
  if (err.status === 403 && code === 'FORBIDDEN') {
    return 'System statuses cannot be deleted. Hide them from customers or adjust visibility instead.'
  }
  if (err.status === 409 && code === 'CONFLICT') {
    if (/history|status history/i.test(raw)) {
      return `${raw} You can hide this status from customers instead of deleting it.`
    }
    if (/orders/i.test(raw)) {
      return `${raw} Use “Move orders and delete” to pick another status for those orders.`
    }
  }
  return raw
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const m = err.message?.trim()
    return m || `Request failed (${err.status})`
  }
  if (err instanceof Error) {
    const m = err.message?.trim()
    return m || 'Something went wrong'
  }
  return 'Something went wrong'
}
