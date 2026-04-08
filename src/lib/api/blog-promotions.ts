import { request } from './client'

export type BlogPromotionCTA = {
  label: string
  url: string
}

export type BlogPromotionRecord = {
  id: string
  title: string
  imageUrl: string
  blogId: string
  ctaButtons: BlogPromotionCTA[]
  priorityOrder: number
  isActive: boolean
  startAt?: string
  endAt?: string
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

export function normalizeBlogPromotion(raw: unknown): BlogPromotionRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      title: '',
      imageUrl: '',
      blogId: '',
      ctaButtons: [],
      priorityOrder: 0,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }
  }
  const o = raw as Record<string, unknown>
  const cta: BlogPromotionCTA[] = []
  const arr = o.ctaButtons ?? o.cta_buttons
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const c = x as Record<string, unknown>
      const label = pickStr(c, 'label', 'Label')
      const url = pickStr(c, 'url', 'URL', 'Url')
      if (label && url) cta.push({ label, url })
    }
  }
  return {
    id: pickStr(o, 'id', 'Id') ?? '',
    title: pickStr(o, 'title', 'Title') ?? '',
    imageUrl: pickStr(o, 'imageUrl', 'image_url') ?? '',
    blogId: pickStr(o, 'blogId', 'blog_id') ?? '',
    ctaButtons: cta,
    priorityOrder: pickNum(o, 'priorityOrder', 'priority_order') ?? 0,
    isActive: pickBool(o, 'isActive', 'is_active') !== false,
    startAt: pickStr(o, 'startAt', 'start_at'),
    endAt: pickStr(o, 'endAt', 'end_at'),
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    updatedAt: pickStr(o, 'updatedAt', 'updated_at') ?? '',
  }
}

export type BlogPromotionWriteInput = {
  title: string
  imageUrl: string
  blogId: string
  ctaButtons: BlogPromotionCTA[]
  priorityOrder: number
  isActive: boolean
  startAt: string | undefined
  endAt: string | undefined
}

function buildBody(input: BlogPromotionWriteInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: input.title.trim(),
    imageUrl: input.imageUrl.trim(),
    blogId: input.blogId.trim(),
    ctaButtons: input.ctaButtons,
    priorityOrder: input.priorityOrder,
    isActive: input.isActive,
  }
  if (input.startAt) body.startAt = input.startAt
  if (input.endAt) body.endAt = input.endAt
  return body
}

export async function fetchBlogPromotionsList(
  token: string | null,
  params: { limit: number; offset: number },
): Promise<{ items: BlogPromotionRecord[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  const raw = await request<unknown>(`/api/v1/blog-promotions?${q}`, { method: 'GET', token })
  const items: BlogPromotionRecord[] = []
  let total = 0
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const arr = o.blogPromotions ?? o.blog_promotions
    if (Array.isArray(arr)) {
      for (const row of arr) items.push(normalizeBlogPromotion(row))
    }
    const t = o.total
    if (typeof t === 'number' && Number.isFinite(t)) total = t
  }
  return { items, total }
}

export async function fetchBlogPromotionDetail(
  token: string | null,
  id: string,
): Promise<BlogPromotionRecord> {
  const enc = encodeURIComponent(id)
  const raw = await request<unknown>(`/api/v1/blog-promotions/${enc}`, { method: 'GET', token })
  return normalizeBlogPromotion(raw)
}

export async function createBlogPromotion(
  token: string,
  input: BlogPromotionWriteInput,
): Promise<BlogPromotionRecord> {
  const raw = await request<unknown>('/api/v1/blog-promotions', {
    method: 'POST',
    token,
    body: buildBody(input),
  })
  return normalizeBlogPromotion(raw)
}

export async function updateBlogPromotion(
  token: string,
  id: string,
  input: BlogPromotionWriteInput,
): Promise<BlogPromotionRecord> {
  const enc = encodeURIComponent(id)
  const raw = await request<unknown>(`/api/v1/blog-promotions/${enc}`, {
    method: 'PUT',
    token,
    body: buildBody(input),
  })
  return normalizeBlogPromotion(raw)
}

export async function deleteBlogPromotion(token: string | null, id: string): Promise<void> {
  const enc = encodeURIComponent(id)
  await request(`/api/v1/blog-promotions/${enc}`, { method: 'DELETE', token })
}
