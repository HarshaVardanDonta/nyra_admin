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
  const m = o.message ?? o.error ?? o.detail
  if (typeof m === 'string') return m
  if (Array.isArray(m) && typeof m[0] === 'string') return m.join(', ')
  return null
}

export function toApiError(status: number, body: unknown): ApiError {
  const fromBody = messageFromBody(body)
  const message = fromBody ?? `Request failed (${status})`
  return new ApiError(message, status, body)
}
