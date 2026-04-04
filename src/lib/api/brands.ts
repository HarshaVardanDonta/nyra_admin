import { request } from './client'
import { ApiError } from './errors'

function arrayFromPayload(raw: unknown, keys: string[]): unknown[] {
  if (!raw || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  for (const k of keys) {
    const v = o[k]
    if (Array.isArray(v)) return v
  }
  return []
}

function totalFromPayload(raw: unknown, itemsLen: number): number {
  if (!raw || typeof raw !== 'object') return itemsLen
  const o = raw as Record<string, unknown>
  const t = o.total ?? o.totalCount ?? o.count
  if (typeof t === 'number' && Number.isFinite(t)) return t
  const meta = o.meta
  if (meta && typeof meta === 'object') {
    const mt = (meta as Record<string, unknown>).total
    if (typeof mt === 'number' && Number.isFinite(mt)) return mt
  }
  return itemsLen
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return undefined
}

function pickId(o: Record<string, unknown>): string | undefined {
  for (const k of ['id', 'brandId', '_id']) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  }
  return undefined
}

/** Many handlers wrap the entity as `data`, `brand`, `item`, etc. */
function unwrapBrandObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const innerKeys = ['data', 'brand', 'item', 'result', 'payload', 'body']
  for (const k of innerKeys) {
    const inner = o[k]
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const io = inner as Record<string, unknown>
      if (pickId(io)) return io
    }
  }
  return o
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

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

/** Normalized admin / catalog brand row for list and detail UIs. */
export type BrandRecord = {
  id: string
  name: string
  slug?: string
  description?: string
  websiteUrl?: string
  isActive?: boolean
  isFeatured?: boolean
  logoUrl?: string
  bannerUrl?: string
  /** Optional tagline / vertical from API */
  categoryLabel?: string
  productCount?: number
  totalSalesCents?: number
}

export function normalizeBrandRow(raw: unknown): BrandRecord | null {
  const o = unwrapBrandObject(raw)
  if (!o) return null
  const id = pickId(o)
  if (!id) return null
  const name =
    pickStr(o, 'name', 'title', 'brandName') ??
    pickStr(o, 'slug') ??
    'Untitled brand'

  return {
    id,
    name,
    slug: pickStr(o, 'slug'),
    description: pickStr(o, 'description', 'summary'),
    websiteUrl: pickStr(o, 'websiteUrl', 'website', 'url'),
    isActive: pickBool(o, 'isActive', 'active', 'is_active'),
    isFeatured: pickBool(o, 'isFeatured', 'featured', 'is_featured'),
    logoUrl: pickStr(o, 'logoUrl', 'logo', 'thumbnailUrl', 'imageUrl'),
    bannerUrl: pickStr(o, 'bannerUrl', 'banner'),
    categoryLabel: pickStr(o, 'category', 'vertical', 'tagline'),
    productCount: pickNum(o, 'productCount', 'productsCount', 'product_count', 'itemsCount'),
    totalSalesCents: pickNum(o, 'totalSalesCents', 'totalSales', 'revenueCents', 'salesTotalCents'),
  }
}

function mapListItems(raw: unknown): BrandRecord[] {
  const arr = arrayFromPayload(raw, ['items', 'brands', 'data', 'results'])
  const out: BrandRecord[] = []
  for (const item of arr) {
    const row = normalizeBrandRow(item)
    if (row) out.push(row)
  }
  return out
}

export type BrandListParams = {
  limit: number
  offset: number
  search?: string
  status?: 'all' | 'active' | 'inactive'
}

/**
 * List brands: public `GET /api/v1/catalog/brands` when unauthenticated (active storefront only).
 * With an admin token, `GET /api/v1/brands` lists every brand including inactive (Postman Admin Catalog).
 */
export async function fetchBrandsList(
  token: string | null,
  params: BrandListParams,
): Promise<{ items: BrandRecord[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.search?.trim()) q.set('search', params.search.trim())
  const st = params.status ?? 'all'
  if (st === 'active') {
    q.set('isActive', 'true')
    q.set('is_active', 'true')
  } else if (st === 'inactive') {
    q.set('isActive', 'false')
    q.set('is_active', 'false')
  }

  const fromCatalog = async (): Promise<{ items: BrandRecord[]; total: number }> => {
    const raw = await request<unknown>(`/api/v1/catalog/brands?${q}`, { method: 'GET' })
    let items = mapListItems(raw)
    if (st === 'inactive') {
      items = []
    }
    const total = totalFromPayload(raw, items.length)
    return { items, total }
  }

  if (token && st === 'inactive') {
    try {
      const raw = await request<unknown>(`/api/v1/brands?${q}`, { method: 'GET', token })
      const items = mapListItems(raw)
      const total = totalFromPayload(raw, items.length)
      return { items, total }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        /* catalog cannot list inactive; return empty */
      } else {
        throw e
      }
    }
    return fromCatalog()
  }

  return fromCatalog()
}

/** Single brand: `GET /api/v1/catalog/brands/:brandKey`; inactive-only rows resolve via admin list (no admin GET-by-id route). */
export async function fetchBrandDetail(token: string | null, brandKey: string): Promise<BrandRecord> {
  const encoded = encodeURIComponent(brandKey)
  let lastCatalogErr: unknown
  try {
    const raw = await request<unknown>(`/api/v1/catalog/brands/${encoded}`, { method: 'GET' })
    const row = normalizeBrandRow(raw)
    if (row) return row
  } catch (e) {
    lastCatalogErr = e
  }
  if (token) {
    try {
      const q = new URLSearchParams({ limit: '200', offset: '0' })
      const raw = await request<unknown>(`/api/v1/brands?${q}`, { method: 'GET', token })
      const items = mapListItems(raw)
      const hit = items.find((b) => b.id === brandKey || b.slug === brandKey)
      if (hit) return hit
    } catch {
      /* ignore */
    }
  }
  if (lastCatalogErr instanceof ApiError) {
    throw lastCatalogErr
  }
  throw new ApiError('Brand not found', 404)
}

export async function createBrand(
  token: string,
  formData: FormData,
): Promise<{ id: string } & Record<string, unknown>> {
  return request(`/api/v1/brands`, { method: 'POST', token, body: formData })
}

/** Resolve brand id from POST /api/v1/brands response (handles wrappers and numeric ids). */
export function brandIdFromCreateResponse(res: unknown): string {
  const row = normalizeBrandRow(res)
  if (row?.id) return row.id
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>
    const direct = pickId(o)
    if (direct) return direct
  }
  return ''
}

type BrandUpdateBody = Record<string, unknown> | FormData

/** Postman + Nyra API: `PATCH /api/v1/brands/:brandID` (JSON or multipart). */
async function requestBrandUpdate(
  token: string,
  brandId: string,
  body: BrandUpdateBody,
): Promise<unknown> {
  const encoded = encodeURIComponent(brandId)
  return request(`/api/v1/brands/${encoded}`, { method: 'PATCH', token, body })
}

export async function updateBrandJson(
  token: string,
  brandId: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return requestBrandUpdate(token, brandId, body)
}

export async function updateBrandMultipart(
  token: string,
  brandId: string,
  formData: FormData,
): Promise<unknown> {
  return requestBrandUpdate(token, brandId, formData)
}

/** Admin catalog in Postman has no brand delete route. */
export async function deleteBrand(_token: string, _brandId: string): Promise<boolean> {
  return false
}
