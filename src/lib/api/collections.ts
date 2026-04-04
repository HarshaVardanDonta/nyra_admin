import { request } from './client'
import { normalizeCatalogProductRow, type CatalogProductRow } from './catalog'

function arrayFromPayload(raw: unknown, keys: string[]): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v
  }
  return []
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

export type CollectionSort =
  | 'created_desc'
  | 'created_asc'
  | 'name_asc'
  | 'name_desc'

export type CollectionStatusFilter = 'all' | 'published' | 'draft'

export type CollectionRecord = {
  id: string
  name: string
  slug: string
  description: string
  bannerImageUrl: string
  thumbnailUrl: string
  displayAsStrip: boolean
  displayPriority: number
  status: string
  createdAt: string
  updatedAt: string
  productCount: number
  products: CatalogProductRow[]
}

function normalizeCollection(raw: unknown, includeProducts: boolean): CollectionRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      name: '',
      slug: '',
      description: '',
      bannerImageUrl: '',
      thumbnailUrl: '',
      displayAsStrip: false,
      displayPriority: 1,
      status: 'draft',
      createdAt: '',
      updatedAt: '',
      productCount: 0,
      products: [],
    }
  }
  const o = raw as Record<string, unknown>
  const id = pickStr(o, 'id', 'Id') ?? ''
  const productsRaw = includeProducts ? arrayFromPayload(o, ['products', 'Products']) : []
  const products = includeProducts
    ? productsRaw.map((row) => normalizeCatalogProductRow(row))
    : []
  const pc = pickNum(o, 'productCount', 'product_count')
  const productCount = pc ?? (includeProducts ? products.length : 0)
  return {
    id,
    name: pickStr(o, 'name', 'Name') ?? '',
    slug: pickStr(o, 'slug', 'Slug') ?? '',
    description: pickStr(o, 'description', 'Description') ?? '',
    bannerImageUrl: pickStr(o, 'bannerImageUrl', 'banner_image_url', 'BannerImageUrl') ?? '',
    thumbnailUrl: pickStr(o, 'thumbnailUrl', 'thumbnail_url', 'ThumbnailUrl') ?? '',
    displayAsStrip: pickBool(o, 'displayAsStrip', 'display_as_strip') ?? false,
    displayPriority: pickNum(o, 'displayPriority', 'display_priority') ?? 1,
    status: pickStr(o, 'status', 'Status') ?? 'draft',
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    updatedAt: pickStr(o, 'updatedAt', 'updated_at') ?? '',
    productCount,
    products,
  }
}

export type ListCollectionsParams = {
  limit: number
  offset: number
  status?: CollectionStatusFilter
  sort?: CollectionSort
}

export async function fetchCollectionsList(
  token: string | null,
  params: ListCollectionsParams,
): Promise<{ items: CollectionRecord[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.status && params.status !== 'all') q.set('status', params.status)
  if (params.sort) q.set('sort', params.sort)

  const raw = await request<unknown>(`/api/v1/collections?${q}`, { method: 'GET', token })
  const rows = arrayFromPayload(raw, ['collections', 'items', 'data'])
  const items = rows.map((row) => normalizeCollection(row, false))
  let total = items.length
  if (raw && typeof raw === 'object') {
    const t = (raw as Record<string, unknown>).total
    if (typeof t === 'number' && Number.isFinite(t)) total = t
  }
  return { items, total }
}

export async function fetchCollectionDetail(
  token: string | null,
  collectionId: string,
): Promise<CollectionRecord> {
  const enc = encodeURIComponent(collectionId)
  const raw = await request<unknown>(`/api/v1/collections/${enc}`, { method: 'GET', token })
  return normalizeCollection(raw, true)
}

export type CollectionAnalytics = {
  views: number
  viewsTrendPercent: number
  salesCents: number
  salesTrendPercent: number
  conversionRatePercent: number
}

export async function fetchCollectionAnalytics(
  token: string | null,
  collectionId: string,
): Promise<CollectionAnalytics> {
  const enc = encodeURIComponent(collectionId)
  const raw = await request<Record<string, unknown>>(`/api/v1/collections/${enc}/analytics`, {
    method: 'GET',
    token,
  })
  return {
    views: typeof raw.views === 'number' ? raw.views : 0,
    viewsTrendPercent: typeof raw.viewsTrendPercent === 'number' ? raw.viewsTrendPercent : 0,
    salesCents: typeof raw.salesCents === 'number' ? raw.salesCents : 0,
    salesTrendPercent: typeof raw.salesTrendPercent === 'number' ? raw.salesTrendPercent : 0,
    conversionRatePercent:
      typeof raw.conversionRatePercent === 'number' ? raw.conversionRatePercent : 0,
  }
}

export type CollectionWriteBody = {
  name: string
  slug: string
  description: string
  bannerImageUrl: string
  thumbnailUrl: string
  displayAsStrip: boolean
  displayPriority: number
  status: string
}

export async function createCollection(
  token: string | null,
  body: CollectionWriteBody | FormData,
): Promise<CollectionRecord> {
  const raw = await request<unknown>(`/api/v1/collections`, {
    method: 'POST',
    token,
    body,
  })
  return normalizeCollection(raw, true)
}

export async function updateCollection(
  token: string | null,
  collectionId: string,
  body: CollectionWriteBody | FormData,
): Promise<CollectionRecord> {
  const enc = encodeURIComponent(collectionId)
  const raw = await request<unknown>(`/api/v1/collections/${enc}`, {
    method: 'PATCH',
    token,
    body,
  })
  return normalizeCollection(raw, true)
}

export async function deleteCollection(token: string | null, collectionId: string): Promise<void> {
  const enc = encodeURIComponent(collectionId)
  await request(`/api/v1/collections/${enc}`, { method: 'DELETE', token })
}

export async function addCollectionProducts(
  token: string | null,
  collectionId: string,
  productIds: string[],
): Promise<void> {
  const enc = encodeURIComponent(collectionId)
  await request(`/api/v1/collections/${enc}/products`, {
    method: 'POST',
    token,
    body: { productIds },
  })
}

export async function removeCollectionProduct(
  token: string | null,
  collectionId: string,
  productId: string,
): Promise<void> {
  const encC = encodeURIComponent(collectionId)
  const encP = encodeURIComponent(productId)
  await request(`/api/v1/collections/${encC}/products/${encP}`, { method: 'DELETE', token })
}

export function collectionSlugSegment(fullSlug: string): string {
  const t = fullSlug.trim()
  if (t.startsWith('/collections/')) return t.slice('/collections/'.length)
  return t.replace(/^\//, '')
}

export function slugifySegment(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function toApiCollectionSlug(segmentOrFull: string): string {
  const t = segmentOrFull.trim()
  if (t.startsWith('/collections/')) return t
  const seg = slugifySegment(t)
  if (!seg) return ''
  return `/collections/${seg}`
}
