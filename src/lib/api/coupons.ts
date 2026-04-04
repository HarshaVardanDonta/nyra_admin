import { request } from './client'

export type CouponDiscountType = 'percentage' | 'fixed'

export type CouponTabBucket = 'all' | 'active' | 'scheduled' | 'expired' | 'inactive'

export type CouponRecord = {
  id: string
  code: string
  description: string
  isActive: boolean
  discountType: CouponDiscountType | string
  discountValue: number
  minimumOrderValue: number
  maximumDiscount?: number
  totalUsageLimit?: number
  usagePerCustomer: number
  timesUsed: number
  startDate?: string
  expirationDate?: string
  createdAt: string
  updatedAt: string
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string') return v
  }
  return undefined
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

function pickBool(o: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'boolean') return v
    if (v === 'true') return true
    if (v === 'false') return false
  }
  return undefined
}

function isoish(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined
  return v
}

export function normalizeCoupon(raw: unknown): CouponRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      code: '',
      description: '',
      isActive: true,
      discountType: 'percentage',
      discountValue: 0,
      minimumOrderValue: 0,
      usagePerCustomer: 1,
      timesUsed: 0,
      createdAt: '',
      updatedAt: '',
    }
  }
  const o = raw as Record<string, unknown>
  const dt = (pickStr(o, 'discountType', 'discount_type') ?? 'percentage').toLowerCase()
  return {
    id: pickStr(o, 'id', 'Id') ?? '',
    code: pickStr(o, 'code', 'Code') ?? '',
    description: pickStr(o, 'description', 'Description') ?? '',
    isActive: pickBool(o, 'isActive', 'is_active') !== false,
    discountType: dt === 'fixed' ? 'fixed' : 'percentage',
    discountValue: pickNum(o, 'discountValue', 'discount_value') ?? 0,
    minimumOrderValue: pickNum(o, 'minimumOrderValue', 'minimum_order_value') ?? 0,
    maximumDiscount: pickNum(o, 'maximumDiscount', 'maximum_discount'),
    totalUsageLimit: pickNum(o, 'totalUsageLimit', 'total_usage_limit'),
    usagePerCustomer: pickNum(o, 'usagePerCustomer', 'usage_per_customer') ?? 1,
    timesUsed: pickNum(o, 'timesUsed', 'times_used') ?? 0,
    startDate: isoish(o.startDate ?? o.StartDate),
    expirationDate: isoish(o.expirationDate ?? o.ExpirationDate),
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    updatedAt: pickStr(o, 'updatedAt', 'updated_at') ?? '',
  }
}

/** Aligns with backend `coupon.ResolveValidity` ordering for display. */
export function couponDisplayStatus(
  c: CouponRecord,
  nowMs: number = Date.now(),
): 'active' | 'scheduled' | 'expired' | 'inactive' {
  const exp = c.expirationDate ? new Date(c.expirationDate).getTime() : NaN
  const start = c.startDate ? new Date(c.startDate).getTime() : NaN
  if (c.expirationDate && !Number.isNaN(exp) && exp <= nowMs) return 'expired'
  if (c.totalUsageLimit != null && c.timesUsed >= c.totalUsageLimit) return 'expired'
  if (c.isActive && c.startDate && !Number.isNaN(start) && start > nowMs) return 'scheduled'
  if (!c.isActive) return 'inactive'
  return 'active'
}

export function couponTabBucket(c: CouponRecord, nowMs?: number): CouponTabBucket {
  const s = couponDisplayStatus(c, nowMs)
  if (s === 'active') return 'active'
  if (s === 'scheduled') return 'scheduled'
  if (s === 'expired') return 'expired'
  return 'inactive'
}

export type CouponListParams = {
  limit: number
  offset: number
  /** Passed to API as `active=true` / `active=false`; omit for all. */
  active?: boolean
}

export async function fetchCouponsList(
  token: string | null,
  params: CouponListParams,
): Promise<{ items: CouponRecord[] }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.active === true) q.set('active', 'true')
  if (params.active === false) q.set('active', 'false')
  const raw = await request<unknown>(`/api/v1/coupons?${q}`, { method: 'GET', token })
  const coupons: unknown[] = []
  if (raw && typeof raw === 'object') {
    const arr = (raw as Record<string, unknown>).coupons
    if (Array.isArray(arr)) {
      for (const row of arr) coupons.push(row)
    }
  }
  return { items: coupons.map(normalizeCoupon) }
}

export async function fetchCouponDetail(token: string | null, couponId: string): Promise<CouponRecord> {
  const enc = encodeURIComponent(couponId)
  const raw = await request<unknown>(`/api/v1/coupons/${enc}`, { method: 'GET', token })
  return normalizeCoupon(raw)
}

export async function deleteCoupon(token: string | null, couponId: string): Promise<void> {
  const enc = encodeURIComponent(couponId)
  await request(`/api/v1/coupons/${enc}`, { method: 'DELETE', token })
}

/** Matches backend `coupon.generateUniqueCode` alphabet and length (best-effort preview; server may still reject on rare collision). */
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const CODE_LEN = 8

export function generateCouponCodePreview(): string {
  let s = ''
  for (let i = 0; i < CODE_LEN; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return s
}

export type CouponWriteInput = {
  code: string
  description: string
  isActive: boolean
  discountType: CouponDiscountType
  discountValue: number
  minimumOrderValue: number
  maximumDiscount?: number
  totalUsageLimit?: number
  usagePerCustomer: number
  startDate?: string
  expirationDate?: string
}

function buildCouponBody(input: CouponWriteInput, mode: 'create' | 'update'): Record<string, unknown> {
  const body: Record<string, unknown> = {
    description: input.description.trim(),
    isActive: input.isActive,
    discountType: input.discountType,
    discountValue: input.discountValue,
    usagePerCustomer: input.usagePerCustomer,
  }
  const code = input.code.trim().toUpperCase()
  if (mode === 'update' || code !== '') {
    body.code = code
  }
  if (input.minimumOrderValue > 0) {
    body.minimumOrderValue = input.minimumOrderValue
  } else {
    body.minimumOrderValue = 0
  }
  if (input.maximumDiscount != null && input.maximumDiscount > 0) {
    body.maximumDiscount = input.maximumDiscount
  }
  if (input.totalUsageLimit != null && input.totalUsageLimit > 0) {
    body.totalUsageLimit = Math.floor(input.totalUsageLimit)
  }
  if (input.startDate) body.startDate = input.startDate
  if (input.expirationDate) body.expirationDate = input.expirationDate
  return body
}

export async function createCoupon(token: string, input: CouponWriteInput): Promise<CouponRecord> {
  const raw = await request<unknown>('/api/v1/coupons', {
    method: 'POST',
    token,
    body: buildCouponBody(input, 'create'),
  })
  return normalizeCoupon(raw)
}

export async function updateCoupon(token: string, couponId: string, input: CouponWriteInput): Promise<CouponRecord> {
  const enc = encodeURIComponent(couponId)
  const raw = await request<unknown>(`/api/v1/coupons/${enc}`, {
    method: 'PUT',
    token,
    body: buildCouponBody(input, 'update'),
  })
  return normalizeCoupon(raw)
}
