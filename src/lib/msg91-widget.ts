/**
 * MSG91 OTP Widget: browser calls (direct) or Nyra API proxy (recommended for mobile).
 * Web-only MSG91 widgets reject mobile browsers; the server proxy uses a desktop User-Agent.
 */

import { request } from './api/client'

const DEFAULT_WIDGET_API_ORIGIN = 'https://control.msg91.com/api/v5/widget'

function widgetApiBase(): string {
  const raw = (
    import.meta.env.VITE_MSG91_WIDGET_API_BASE as string | undefined
  )?.trim()
  if (raw) {
    return raw.replace(/\/+$/, '')
  }
  return DEFAULT_WIDGET_API_ORIGIN
}

let activeCredentials: { widgetId: string; tokenAuth: string } | null = null

/** When false/`0`, use legacy Nyra `/auth/otp/send` + `/verify` even if widget env vars are set. */
export function isMsg91WidgetDisabledByEnv(): boolean {
  const v = (import.meta.env.VITE_USE_MSG91_WIDGET as string | undefined)
    ?.trim()
    .toLowerCase()
  return v === 'false' || v === '0'
}

/**
 * When true (default), widget send/verify/retry go through `POST /api/v1/auth/otp/widget/*`
 * so the backend can satisfy MSG91 web-only widgets from mobile browsers.
 * Set `VITE_MSG91_WIDGET_USE_SERVER_PROXY=false` to call MSG91 directly from the browser (desktop only).
 */
export function useMsg91WidgetServerProxy(): boolean {
  if (isMsg91WidgetDisabledByEnv()) {
    return false
  }
  const v = import.meta.env.VITE_MSG91_WIDGET_USE_SERVER_PROXY?.trim().toLowerCase()
  if (v === 'false' || v === '0') {
    return false
  }
  return true
}

export function getMsg91WidgetCredentials(): {
  widgetId: string
  authToken: string
} | null {
  if (isMsg91WidgetDisabledByEnv()) {
    return null
  }
  const widgetId = (import.meta.env.VITE_MSG91_WIDGET_ID as string | undefined)?.trim()
  const authToken = (
    import.meta.env.VITE_MSG91_WIDGET_AUTH_TOKEN as string | undefined
  )?.trim()
  if (!widgetId || !authToken) {
    return null
  }
  return { widgetId, authToken }
}

export function useMsg91WidgetLogin(): boolean {
  if (isMsg91WidgetDisabledByEnv()) {
    return false
  }
  if (useMsg91WidgetServerProxy()) {
    return Boolean(
      (import.meta.env.VITE_MSG91_WIDGET_ID as string | undefined)?.trim(),
    )
  }
  return getMsg91WidgetCredentials() !== null
}

/** India mobile as MSG91 `identifier`: 91 + 10 digits, no `+`. */
export function toMsg91MobileIdentifier(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits
  }
  return null
}

/** MSG91 widget verify success often returns the access JWT in `message` (not `accessToken`). */
function messageLooksLikeAccessJWT(message: string): boolean {
  const m = message.trim()
  const parts = m.split('.')
  if (parts.length !== 3) {
    return false
  }
  return parts.every((p) => p.length > 0 && /^[A-Za-z0-9_-]+$/.test(p))
}

/** MSG91 widget send success often returns reqId in `message` (not `reqId`). */
function messageLooksLikeWidgetReqId(message: string): boolean {
  const m = message.trim()
  if (m.length < 8) {
    return false
  }
  // Hex-ish ids (e.g. 366466673541303036323632) or long numeric tokens; not human sentences.
  return /^[0-9a-fA-F]+$/.test(m) || /^\d{12,}$/.test(m)
}

export function extractWidgetReqId(res: unknown): string | null {
  if (!res || typeof res !== 'object') {
    return null
  }
  const r = res as Record<string, unknown>
  const fromObj = (o: Record<string, unknown>): string | null => {
    for (const key of ['reqId', 'requestId', 'request_id']) {
      const v = o[key]
      if (typeof v === 'string' && v.trim()) {
        return v.trim()
      }
    }
    return null
  }
  const top = fromObj(r)
  if (top) {
    return top
  }
  const data = r.data
  if (data && typeof data === 'object') {
    const nested = fromObj(data as Record<string, unknown>)
    if (nested) {
      return nested
    }
  }
  const typ = String(r.type ?? '').toLowerCase()
  if (typ !== 'error' && typeof r.message === 'string') {
    const m = r.message.trim()
    if (m && messageLooksLikeWidgetReqId(m)) {
      return m
    }
  }
  return null
}

export function extractWidgetAccessToken(res: unknown): string | null {
  if (!res || typeof res !== 'object') {
    return null
  }
  const r = res as Record<string, unknown>
  const tryKeys = (o: Record<string, unknown>): string | null => {
    for (const key of ['access-token', 'accessToken', 'access_token', 'token']) {
      const v = o[key]
      if (typeof v === 'string' && v.trim()) {
        return v.trim()
      }
    }
    return null
  }
  const topToken = tryKeys(r)
  if (topToken) {
    return topToken
  }
  const data = r.data
  if (data && typeof data === 'object') {
    const inner = tryKeys(data as Record<string, unknown>)
    if (inner) {
      return inner
    }
  }
  const typ = String(r.type ?? '').toLowerCase()
  if (typ !== 'error' && typeof r.message === 'string') {
    const m = r.message.trim()
    if (m && messageLooksLikeAccessJWT(m)) {
      return m
    }
  }
  return null
}

async function widgetPostDirect(
  path: string,
  extra: Record<string, unknown>,
): Promise<unknown> {
  const c = activeCredentials
  if (!c) {
    throw new Error('MSG91 widget not initialized')
  }
  const url = `${widgetApiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const body = {
    widgetId: c.widgetId,
    tokenAuth: c.tokenAuth,
    ...extra,
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json: unknown = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      typeof json === 'object' &&
      json !== null &&
      'message' in json &&
      typeof (json as { message?: unknown }).message === 'string'
        ? String((json as { message: string }).message)
        : `MSG91 request failed (${res.status})`
    throw new Error(msg)
  }
  if (typeof json === 'object' && json !== null) {
    const o = json as Record<string, unknown>
    if (String(o.type).toLowerCase() === 'error') {
      const m =
        typeof o.message === 'string' && o.message.trim()
          ? o.message
          : 'MSG91 returned an error'
      throw new Error(m)
    }
  }
  return json
}

async function widgetPost(
  path: string,
  extra: Record<string, unknown>,
): Promise<unknown> {
  if (useMsg91WidgetServerProxy()) {
    const apiPath =
      path === '/sendOtpMobile'
        ? '/api/v1/auth/otp/widget/send'
        : path === '/verifyOtp'
          ? '/api/v1/auth/otp/widget/verify'
          : path === '/retryOtp'
            ? '/api/v1/auth/otp/widget/retry'
            : ''
    if (!apiPath) {
      throw new Error('unsupported widget path for server proxy')
    }
    const body =
      path === '/sendOtpMobile'
        ? { identifier: extra.identifier }
        : path === '/verifyOtp'
          ? { reqId: extra.reqId, otp: extra.otp }
          : {
              reqId: extra.reqId,
              ...(extra.retryChannel !== undefined
                ? { retryChannel: extra.retryChannel }
                : {}),
            }
    return request<unknown>(apiPath, {
      method: 'POST',
      body,
      skipAuthRefresh: true,
    })
  }
  return widgetPostDirect(path, extra)
}

export function initMsg91Widget(widgetId: string, authToken: string): Promise<void> {
  activeCredentials = { widgetId, tokenAuth: authToken }
  return Promise.resolve()
}

export async function msg91SendOtp(identifier: string): Promise<string> {
  const res = await widgetPost('/sendOtpMobile', { identifier })
  const reqId = extractWidgetReqId(res)
  if (!reqId) {
    throw new Error('OTP send did not return a request id')
  }
  return reqId
}

export async function msg91VerifyOtp(reqId: string, otpCode: string): Promise<string> {
  const res = await widgetPost('/verifyOtp', { reqId, otp: otpCode })
  const token = extractWidgetAccessToken(res)
  if (!token) {
    throw new Error('OTP verification did not return an access token')
  }
  return token
}

/** Optional SMS resend; `retryChannel` 11 = SMS per MSG91 widget docs. */
export function msg91RetryOtp(reqId: string, retryChannel = 11): Promise<unknown> {
  return widgetPost('/retryOtp', { reqId, retryChannel })
}
