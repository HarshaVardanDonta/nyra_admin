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
