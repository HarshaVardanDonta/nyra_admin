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
 * Prefer authenticated `GET /api/v1/brands` when available; fall back to public catalog list
 * (`GET /api/v1/catalog/brands`) which returns active brands only.
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

  if (token) {
    try {
      const raw = await request<unknown>(`/api/v1/brands?${q}`, { method: 'GET', token })
      const items = mapListItems(raw)
      const total = totalFromPayload(raw, items.length)
      return { items, total }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        /* use catalog */
      } else {
        throw e
      }
    }
  }

  const raw = await request<unknown>(`/api/v1/catalog/brands?${q}`, { method: 'GET' })
  let items = mapListItems(raw)
  if (st === 'inactive') {
    items = []
  } else if (st === 'active' || st === 'all') {
    // catalog is active-only; keep as-is
  }
  const total = totalFromPayload(raw, items.length)
  return { items, total }
}

/** Single brand: try admin by id, then public catalog by id or slug. */
export async function fetchBrandDetail(token: string | null, brandKey: string): Promise<BrandRecord> {
  const encoded = encodeURIComponent(brandKey)
  let lastCatalogErr: unknown
  if (token) {
    try {
      const raw = await request<unknown>(`/api/v1/brands/${encoded}`, { method: 'GET', token })
      const row = normalizeBrandRow(raw)
      if (row) return row
    } catch (e) {
      if (!(e instanceof ApiError && (e.status === 404 || e.status === 405))) {
        throw e
      }
    }
  }
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

/**
 * Backends differ: Postman documents PATCH on `/api/v1/brands/:id`, but some stacks
 * only register PUT (like other admin resources) or mount updates under `/catalog/brands/`.
 * Try a short chain and surface the last error if nothing matches.
 */
async function requestBrandUpdate(
  token: string,
  brandId: string,
  body: BrandUpdateBody,
): Promise<unknown> {
  const encoded = encodeURIComponent(brandId)
  const attempts: { method: string; path: string }[] = [
    { method: 'PATCH', path: `/api/v1/brands/${encoded}` },
    { method: 'PUT', path: `/api/v1/brands/${encoded}` },
    { method: 'PATCH', path: `/api/v1/brand/${encoded}` },
    { method: 'PUT', path: `/api/v1/brand/${encoded}` },
    { method: 'PATCH', path: `/api/v1/catalog/brands/${encoded}` },
    { method: 'PUT', path: `/api/v1/catalog/brands/${encoded}` },
  ]

  let lastErr: unknown
  for (const { method, path } of attempts) {
    try {
      return await request(path, { method, token, body })
    } catch (e) {
      lastErr = e
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        continue
      }
      throw e
    }
  }
  throw lastErr
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

export async function deleteBrand(token: string, brandId: string): Promise<boolean> {
  const encoded = encodeURIComponent(brandId)
  try {
    await request(`/api/v1/brands/${encoded}`, { method: 'DELETE', token })
    return true
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
      return false
    }
    throw e
  }
}
