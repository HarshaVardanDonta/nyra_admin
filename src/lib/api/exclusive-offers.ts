import { request } from './client'

export type ExclusiveOfferFilterCategory = {
  id: string
  filterKey: string
  label: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export function filterCategoryLabel(categories: ExclusiveOfferFilterCategory[], key: string): string {
  return categories.find((c) => c.filterKey === key)?.label ?? key
}

export type ExclusiveOfferRecord = {
  id: string
  imageUrl: string
  title: string
  subtitle: string
  chipText: string
  chipColor: string
  filterKey: string
  destinationPath: string
  priorityOrder: number
  isActive: boolean
  startDate?: string
  endDate?: string
  createdAt: string
  updatedAt: string
}

export type ExclusiveOfferWriteInput = {
  imageUrl: string
  title: string
  subtitle: string
  chipText: string
  chipColor: string
  filterKey: string
  destinationPath: string
  priorityOrder: number
  isActive: boolean
  startDate: string | undefined
  endDate: string | undefined
}

export type ExclusiveOfferAnalytics = {
  impressions: number
  impressionsTrendPercent: number
  clicks: number
  clicksTrendPercent: number
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string') return v
  }
  return ''
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return 0
}

function pickBool(o: Record<string, unknown>, ...keys: string[]): boolean {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'boolean') return v
  }
  return false
}

export function normalizeExclusiveOffer(raw: unknown): ExclusiveOfferRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      imageUrl: '',
      title: '',
      subtitle: '',
      chipText: '',
      chipColor: '#2563eb',
      filterKey: 'bundle_deals',
      destinationPath: '/',
      priorityOrder: 1,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }
  }
  const o = raw as Record<string, unknown>
  return {
    id: pickStr(o, 'id', 'Id'),
    imageUrl: pickStr(o, 'imageUrl', 'image_url'),
    title: pickStr(o, 'title', 'Title'),
    subtitle: pickStr(o, 'subtitle', 'Subtitle'),
    chipText: pickStr(o, 'chipText', 'chip_text'),
    chipColor: pickStr(o, 'chipColor', 'chip_color') || '#2563eb',
    filterKey: pickStr(o, 'filterKey', 'filter_key') || 'bundle_deals',
    destinationPath: pickStr(o, 'destinationPath', 'destination_path'),
    priorityOrder: pickNum(o, 'priorityOrder', 'priority_order') || 1,
    isActive: pickBool(o, 'isActive', 'is_active'),
    startDate: pickStr(o, 'startDate', 'start_date') || undefined,
    endDate: pickStr(o, 'endDate', 'end_date') || undefined,
    createdAt: pickStr(o, 'createdAt', 'created_at'),
    updatedAt: pickStr(o, 'updatedAt', 'updated_at'),
  }
}

export function exclusiveOfferStatus(
  p: ExclusiveOfferRecord,
  nowMs: number = Date.now(),
): 'active' | 'scheduled' | 'expired' | 'inactive' {
  const end = p.endDate ? new Date(p.endDate).getTime() : NaN
  const start = p.startDate ? new Date(p.startDate).getTime() : NaN
  if (p.endDate && !Number.isNaN(end) && end <= nowMs) return 'expired'
  if (p.startDate && !Number.isNaN(start) && start > nowMs) return 'scheduled'
  if (!p.isActive) return 'inactive'
  return 'active'
}

export async function fetchExclusiveOffersList(
  token: string | null,
  params: { limit: number; offset: number },
): Promise<{ items: ExclusiveOfferRecord[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  const raw = await request<unknown>(`/api/v1/exclusive-offers?${q}`, { method: 'GET', token })
  const rows: unknown[] = []
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const arr = o.exclusiveOffers ?? o.exclusive_offers
    if (Array.isArray(arr)) {
      for (const row of arr) rows.push(row)
    }
  }
  let total = rows.length
  if (raw && typeof raw === 'object') {
    const t = (raw as Record<string, unknown>).total
    if (typeof t === 'number' && Number.isFinite(t)) total = t
  }
  return { items: rows.map(normalizeExclusiveOffer), total }
}

export async function fetchExclusiveOfferDetail(token: string | null, id: string): Promise<ExclusiveOfferRecord> {
  const enc = encodeURIComponent(id)
  const raw = await request<unknown>(`/api/v1/exclusive-offers/${enc}`, { method: 'GET', token })
  return normalizeExclusiveOffer(raw)
}

export async function fetchExclusiveOfferAnalytics(
  token: string | null,
  id: string,
): Promise<ExclusiveOfferAnalytics> {
  const enc = encodeURIComponent(id)
  const raw = await request<Record<string, unknown>>(`/api/v1/exclusive-offers/${enc}/analytics`, {
    method: 'GET',
    token,
  })
  return {
    impressions: typeof raw.impressions === 'number' ? raw.impressions : 0,
    impressionsTrendPercent:
      typeof raw.impressionsTrendPercent === 'number' ? raw.impressionsTrendPercent : 0,
    clicks: typeof raw.clicks === 'number' ? raw.clicks : 0,
    clicksTrendPercent: typeof raw.clicksTrendPercent === 'number' ? raw.clicksTrendPercent : 0,
  }
}

function buildJsonBody(input: ExclusiveOfferWriteInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    imageUrl: input.imageUrl.trim(),
    title: input.title.trim(),
    subtitle: input.subtitle.trim(),
    chipText: input.chipText.trim(),
    chipColor: input.chipColor.trim(),
    filterKey: input.filterKey.trim(),
    destinationPath: input.destinationPath.trim(),
    priorityOrder: input.priorityOrder,
    isActive: input.isActive,
  }
  if (input.startDate) body.startDate = input.startDate
  if (input.endDate) body.endDate = input.endDate
  return body
}

function buildFormData(input: ExclusiveOfferWriteInput, imageFile: File | null): FormData {
  const fd = new FormData()
  fd.set('imageUrl', input.imageUrl.trim())
  fd.set('title', input.title.trim())
  fd.set('subtitle', input.subtitle.trim())
  fd.set('chipText', input.chipText.trim())
  fd.set('chipColor', input.chipColor.trim())
  fd.set('filterKey', input.filterKey.trim())
  fd.set('destinationPath', input.destinationPath.trim())
  fd.set('priorityOrder', String(input.priorityOrder))
  fd.set('isActive', String(input.isActive))
  fd.set('startDate', input.startDate ?? '')
  fd.set('endDate', input.endDate ?? '')
  if (imageFile) fd.append('image', imageFile)
  return fd
}

export async function createExclusiveOffer(
  token: string,
  input: ExclusiveOfferWriteInput,
  imageFile: File | null,
): Promise<ExclusiveOfferRecord> {
  const raw =
    imageFile != null
      ? await request<unknown>('/api/v1/exclusive-offers', {
          method: 'POST',
          token,
          body: buildFormData(input, imageFile),
        })
      : await request<unknown>('/api/v1/exclusive-offers', {
          method: 'POST',
          token,
          body: buildJsonBody(input),
        })
  return normalizeExclusiveOffer(raw)
}

export async function updateExclusiveOffer(
  token: string,
  offerId: string,
  input: ExclusiveOfferWriteInput,
  imageFile: File | null,
): Promise<ExclusiveOfferRecord> {
  const enc = encodeURIComponent(offerId)
  const raw =
    imageFile != null
      ? await request<unknown>(`/api/v1/exclusive-offers/${enc}`, {
          method: 'PUT',
          token,
          body: buildFormData(input, imageFile),
        })
      : await request<unknown>(`/api/v1/exclusive-offers/${enc}`, {
          method: 'PUT',
          token,
          body: buildJsonBody(input),
        })
  return normalizeExclusiveOffer(raw)
}

export async function deleteExclusiveOffer(token: string | null, offerId: string): Promise<void> {
  const enc = encodeURIComponent(offerId)
  await request(`/api/v1/exclusive-offers/${enc}`, { method: 'DELETE', token })
}

function normalizeFilterCategory(raw: unknown): ExclusiveOfferFilterCategory | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const id = pickStr(o, 'id', 'Id')
  if (!id) return null
  return {
    id,
    filterKey: pickStr(o, 'filterKey', 'filter_key'),
    label: pickStr(o, 'label', 'Label'),
    sortOrder: pickNum(o, 'sortOrder', 'sort_order'),
    createdAt: pickStr(o, 'createdAt', 'created_at'),
    updatedAt: pickStr(o, 'updatedAt', 'updated_at'),
  }
}

export async function fetchExclusiveOfferFilterCategories(
  token: string | null,
): Promise<ExclusiveOfferFilterCategory[]> {
  const raw = await request<unknown>('/api/v1/exclusive-offer-filter-categories', { method: 'GET', token })
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as Record<string, unknown>
  const arr = obj.filterCategories ?? obj.filter_categories
  if (!Array.isArray(arr)) return []
  const out: ExclusiveOfferFilterCategory[] = []
  for (const row of arr) {
    const n = normalizeFilterCategory(row)
    if (n) out.push(n)
  }
  return out
}

export async function createExclusiveOfferFilterCategory(
  token: string,
  input: { filterKey: string; label: string; sortOrder?: number },
): Promise<ExclusiveOfferFilterCategory> {
  const body: Record<string, unknown> = {
    filterKey: input.filterKey.trim(),
    label: input.label.trim(),
  }
  if (input.sortOrder !== undefined) body.sortOrder = input.sortOrder
  const raw = await request<unknown>('/api/v1/exclusive-offer-filter-categories', {
    method: 'POST',
    token,
    body,
  })
  const n = normalizeFilterCategory(raw)
  if (!n) throw new Error('Invalid filter category response')
  return n
}

export async function updateExclusiveOfferFilterCategory(
  token: string,
  id: string,
  input: { label: string; sortOrder?: number },
): Promise<ExclusiveOfferFilterCategory> {
  const enc = encodeURIComponent(id)
  const body: Record<string, unknown> = { label: input.label.trim() }
  if (input.sortOrder !== undefined) body.sortOrder = input.sortOrder
  const raw = await request<unknown>(`/api/v1/exclusive-offer-filter-categories/${enc}`, {
    method: 'PUT',
    token,
    body,
  })
  const n = normalizeFilterCategory(raw)
  if (!n) throw new Error('Invalid filter category response')
  return n
}

export async function deleteExclusiveOfferFilterCategory(token: string, id: string): Promise<void> {
  const enc = encodeURIComponent(id)
  await request(`/api/v1/exclusive-offer-filter-categories/${enc}`, { method: 'DELETE', token })
}
