import { request } from './client'

export type PromotionTargetType = 'collection' | 'product' | 'category'

export type PromotionTabBucket = 'all' | 'active' | 'scheduled' | 'expired'

export type PromotionRecord = {
  id: string
  title: string
  bannerImageUrl: string
  description: string
  startDate?: string
  expirationDate?: string
  priorityOrder: number
  isActive: boolean
  targetType?: string
  targetId?: number
  targetLabel: string
  createdAt: string
  updatedAt: string
}

export type PromotionStats = {
  total: number
  activeLive: number
  scheduled: number
  expired: number
}

export type PromotionListParams = {
  limit: number
  offset: number
  bucket?: PromotionTabBucket
}

export type PromotionWriteInput = {
  title: string
  bannerImageUrl: string
  description: string
  startDate: string | undefined
  expirationDate: string | undefined
  priorityOrder: number
  isActive: boolean
  targetType: string
  targetId: number | undefined
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

export function normalizePromotion(raw: unknown): PromotionRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      title: '',
      bannerImageUrl: '',
      description: '',
      priorityOrder: 1,
      isActive: true,
      targetLabel: '',
      createdAt: '',
      updatedAt: '',
    }
  }
  const o = raw as Record<string, unknown>
  return {
    id: pickStr(o, 'id', 'Id') ?? '',
    title: pickStr(o, 'title', 'Title') ?? '',
    bannerImageUrl: pickStr(o, 'bannerImageUrl', 'banner_image_url', 'BannerImageUrl') ?? '',
    description: pickStr(o, 'description', 'Description') ?? '',
    startDate: isoish(o.startDate ?? o.StartDate),
    expirationDate: isoish(o.expirationDate ?? o.ExpirationDate),
    priorityOrder: pickNum(o, 'priorityOrder', 'priority_order') ?? 1,
    isActive: pickBool(o, 'isActive', 'is_active') !== false,
    targetType: pickStr(o, 'targetType', 'target_type'),
    targetId: pickNum(o, 'targetId', 'target_id'),
    targetLabel: pickStr(o, 'targetLabel', 'target_label') ?? '',
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    updatedAt: pickStr(o, 'updatedAt', 'updated_at') ?? '',
  }
}

/** Strip resource prefix (`prd_12` → numeric id for API). */
export function numericIdFromResourceId(id: string): number | null {
  const last = id.split('_').pop()
  if (!last) return null
  const n = Number.parseInt(last, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function promotionDisplayStatus(
  p: PromotionRecord,
  nowMs: number = Date.now(),
): 'active' | 'scheduled' | 'expired' | 'inactive' {
  const exp = p.expirationDate ? new Date(p.expirationDate).getTime() : NaN
  const start = p.startDate ? new Date(p.startDate).getTime() : NaN
  if (p.expirationDate && !Number.isNaN(exp) && exp <= nowMs) return 'expired'
  if (p.startDate && !Number.isNaN(start) && start > nowMs) return 'scheduled'
  if (!p.isActive) return 'inactive'
  return 'active'
}

export async function fetchPromotionStats(token: string | null): Promise<PromotionStats> {
  const raw = await request<Record<string, unknown>>('/api/v1/promotions/stats', {
    method: 'GET',
    token,
  })
  return {
    total: typeof raw.total === 'number' ? raw.total : 0,
    activeLive: typeof raw.activeLive === 'number' ? raw.activeLive : 0,
    scheduled: typeof raw.scheduled === 'number' ? raw.scheduled : 0,
    expired: typeof raw.expired === 'number' ? raw.expired : 0,
  }
}

export async function fetchPromotionsList(
  token: string | null,
  params: PromotionListParams,
): Promise<{ items: PromotionRecord[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.bucket && params.bucket !== 'all') {
    q.set('bucket', params.bucket)
  }
  const raw = await request<unknown>(`/api/v1/promotions?${q}`, { method: 'GET', token })
  const promotions: unknown[] = []
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const arr = o.promotions
    if (Array.isArray(arr)) {
      for (const row of arr) promotions.push(row)
    }
  }
  let total = promotions.length
  if (raw && typeof raw === 'object') {
    const t = (raw as Record<string, unknown>).total
    if (typeof t === 'number' && Number.isFinite(t)) total = t
  }
  return { items: promotions.map(normalizePromotion), total }
}

export async function fetchPromotionDetail(token: string | null, id: string): Promise<PromotionRecord> {
  const enc = encodeURIComponent(id)
  const raw = await request<unknown>(`/api/v1/promotions/${enc}`, { method: 'GET', token })
  return normalizePromotion(raw)
}

function buildJsonBody(input: PromotionWriteInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    bannerImageUrl: input.bannerImageUrl.trim(),
    description: input.description.trim(),
    priorityOrder: input.priorityOrder,
    isActive: input.isActive,
  }
  if (input.startDate) body.startDate = input.startDate
  if (input.expirationDate) body.expirationDate = input.expirationDate
  const tt = input.targetType.trim().toLowerCase()
  const tid = input.targetId
  if (tt && tid != null && tid > 0) {
    body.targetType = tt
    body.targetId = tid
  } else {
    body.targetType = ''
  }
  return body
}

function buildPromotionFormData(input: PromotionWriteInput, bannerFile: File | null): FormData {
  const fd = new FormData()
  fd.set('title', input.title.trim())
  fd.set('description', input.description.trim())
  fd.set('bannerImageUrl', input.bannerImageUrl.trim())
  fd.set('priorityOrder', String(input.priorityOrder))
  fd.set('isActive', String(input.isActive))
  fd.set('startDate', input.startDate ?? '')
  fd.set('expirationDate', input.expirationDate ?? '')
  const tt = input.targetType.trim().toLowerCase()
  const tid = input.targetId
  if (tt && tid != null && tid > 0) {
    fd.set('targetType', tt)
    fd.set('targetId', String(tid))
  } else {
    fd.set('targetType', '')
    fd.set('targetId', '')
  }
  if (bannerFile) fd.append('banner', bannerFile)
  return fd
}

export async function createPromotion(
  token: string,
  input: PromotionWriteInput,
  bannerFile: File | null,
): Promise<PromotionRecord> {
  const raw =
    bannerFile != null
      ? await request<unknown>('/api/v1/promotions', {
          method: 'POST',
          token,
          body: buildPromotionFormData(input, bannerFile),
        })
      : await request<unknown>('/api/v1/promotions', {
          method: 'POST',
          token,
          body: buildJsonBody(input),
        })
  return normalizePromotion(raw)
}

export async function updatePromotion(
  token: string,
  promotionId: string,
  input: PromotionWriteInput,
  bannerFile: File | null,
): Promise<PromotionRecord> {
  const enc = encodeURIComponent(promotionId)
  const raw =
    bannerFile != null
      ? await request<unknown>(`/api/v1/promotions/${enc}`, {
          method: 'PUT',
          token,
          body: buildPromotionFormData(input, bannerFile),
        })
      : await request<unknown>(`/api/v1/promotions/${enc}`, {
          method: 'PUT',
          token,
          body: buildJsonBody(input),
        })
  return normalizePromotion(raw)
}

export async function deletePromotion(token: string | null, promotionId: string): Promise<void> {
  const enc = encodeURIComponent(promotionId)
  await request(`/api/v1/promotions/${enc}`, { method: 'DELETE', token })
}
