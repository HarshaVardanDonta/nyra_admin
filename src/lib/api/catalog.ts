import { request } from './client'

export type CatalogBrand = {
  id: string
  name: string
  slug?: string
}

export type CatalogCategory = {
  id: string
  name: string
  slug?: string
  parentCategoryId?: string | null
}

function pickRecordField<T>(
  o: Record<string, unknown>,
  camel: string,
  pascal: string,
): T | undefined {
  const v = o[camel] ?? o[pascal]
  return v as T | undefined
}

function pickStr(o: Record<string, unknown>, camel: string, pascal: string): string | undefined {
  const v = pickRecordField<unknown>(o, camel, pascal)
  if (typeof v === 'string') return v
  if (v != null && typeof v !== 'object') return String(v)
  return undefined
}

function pickNum(o: Record<string, unknown>, camel: string, pascal: string): number | undefined {
  const v = pickRecordField<unknown>(o, camel, pascal)
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function pickNumOrNull(
  o: Record<string, unknown>,
  camel: string,
  pascal: string,
): number | null | undefined {
  const v = pickRecordField<unknown>(o, camel, pascal)
  if (v === null) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function pickBool(o: Record<string, unknown>, camel: string, pascal: string): boolean | undefined {
  const v = pickRecordField<unknown>(o, camel, pascal)
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}

function pickTaxComponents(o: Record<string, unknown>): CatalogTaxComponent[] | undefined {
  const raw = o.taxComponents ?? o.TaxComponents
  if (!Array.isArray(raw)) return undefined
  const out: CatalogTaxComponent[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const row = x as Record<string, unknown>
    const label =
      typeof row.label === 'string'
        ? row.label
        : typeof row.Label === 'string'
          ? row.Label
          : ''
    const rv = row.rate ?? row.Rate
    const rate =
      typeof rv === 'number' && Number.isFinite(rv)
        ? rv
        : typeof rv === 'string' && rv.trim()
          ? Number(rv)
          : Number.NaN
    if (!Number.isFinite(rate)) continue
    out.push({ label: label.trim() || 'Tax', rate })
  }
  return out.length ? out : undefined
}

export type CatalogTaxComponent = {
  label: string
  /** 0..1 */
  rate: number
}

/**
 * Admin/create responses may use Go-style PascalCase for nested fields; normalize to the shape the UI expects.
 */
export function normalizeCatalogProductRow(raw: unknown): CatalogProductRow {
  if (!raw || typeof raw !== 'object') {
    return { id: '', name: '' }
  }
  const o = raw as Record<string, unknown>
  const rawId = o.id ?? o.Id
  const id = typeof rawId === 'string' ? rawId : rawId != null ? String(rawId) : ''
  const name =
    typeof o.name === 'string' ? o.name : typeof o.Name === 'string' ? o.Name : ''

  const seoRaw = o.seo
  let seo: CatalogProductRow['seo']
  if (seoRaw && typeof seoRaw === 'object') {
    const s = seoRaw as Record<string, unknown>
    seo = {
      slug: pickStr(s, 'slug', 'Slug'),
      metaTitle: pickStr(s, 'metaTitle', 'MetaTitle'),
      metaDescription: pickStr(s, 'metaDescription', 'MetaDescription'),
    }
  }

  const statusRaw = o.status
  let status: CatalogProductRow['status']
  if (statusRaw && typeof statusRaw === 'object') {
    const st = statusRaw as Record<string, unknown>
    const isPub = pickBool(st, 'isPublished', 'IsPublished')
    const vis = pickStr(st, 'visibility', 'Visibility')
    const sched = st.scheduledAt ?? st.ScheduledAt
    status = {
      isPublished: isPub,
      visibility: vis,
      scheduledAt:
        sched === null || typeof sched === 'string' ? (sched as string | null) : undefined,
    }
  }

  let variants: CatalogProductRow['variants']
  const variantsRaw = o.variants
  if (Array.isArray(variantsRaw)) {
    variants = variantsRaw.map((item) => {
      if (!item || typeof item !== 'object')
        return { name: '', values: [] as string[], defaultValue: '' }
      const vr = item as Record<string, unknown>
      const vn = pickStr(vr, 'name', 'Name') ?? ''
      const vals = vr.values ?? vr.Values
      const values = Array.isArray(vals)
        ? vals.map((x) => (typeof x === 'string' ? x : x != null ? String(x) : '')).filter(Boolean)
        : []
      const defaultValue = pickStr(vr, 'defaultValue', 'DefaultValue') ?? ''
      const rawAdj = vr.valuePriceAdjustments ?? vr.ValuePriceAdjustments
      let valuePriceAdjustments: Record<string, number> | undefined
      if (rawAdj && typeof rawAdj === 'object' && !Array.isArray(rawAdj)) {
        const m: Record<string, number> = {}
        for (const [k, v] of Object.entries(rawAdj as Record<string, unknown>)) {
          if (typeof v === 'number' && Number.isFinite(v)) m[k] = v
        }
        if (Object.keys(m).length) valuePriceAdjustments = m
      }
      return { name: vn, values, defaultValue, valuePriceAdjustments }
    })
  }

  const media = Array.isArray(o.media) ? o.media : undefined
  let thumbnailUrl = pickStr(o, 'thumbnailUrl', 'ThumbnailUrl')
  if (!thumbnailUrl && media?.length) {
    const first = media[0]
    if (first && typeof first === 'object') {
      const m = first as Record<string, unknown>
      const url = m.url ?? m.URL
      thumbnailUrl = typeof url === 'string' ? url : undefined
    }
  }

  return {
    id,
    name,
    description: pickStr(o, 'description', 'Description'),
    sku: pickStr(o, 'sku', 'Sku'),
    basePrice: pickNum(o, 'basePrice', 'BasePrice'),
    discountPrice: pickNumOrNull(o, 'discountPrice', 'DiscountPrice'),
    hasSpecialDiscount: pickBool(o, 'hasSpecialDiscount', 'HasSpecialDiscount'),
    discountExpiry: (() => {
      const v = o.discountExpiry ?? o.DiscountExpiry
      if (v === null) return null
      if (typeof v === 'string') return v
      return undefined
    })(),
    stockQuantity: pickNum(o, 'stockQuantity', 'StockQuantity'),
    isOutOfStock: pickBool(o, 'isOutOfStock', 'IsOutOfStock'),
    thumbnailUrl,
    taxRate: pickNumOrNull(o, 'taxRate', 'TaxRate'),
    taxComponents: pickTaxComponents(o),
    brandId: pickStr(o, 'brandId', 'BrandId'),
    categoryId: pickStr(o, 'categoryId', 'CategoryId'),
    brand:
      o.brand && typeof o.brand === 'object'
        ? (o.brand as CatalogProductRow['brand'])
        : undefined,
    category:
      o.category && typeof o.category === 'object'
        ? (o.category as CatalogProductRow['category'])
        : undefined,
    seo,
    status,
    variants,
    media,
  }
}

/** Loose shape: catalog and admin responses may differ slightly. */
export type CatalogProductRow = {
  id: string
  name: string
  description?: string
  sku?: string
  basePrice?: number
  discountPrice?: number | null
  hasSpecialDiscount?: boolean
  discountExpiry?: string | null
  stockQuantity?: number
  isOutOfStock?: boolean
  thumbnailUrl?: string
  /** 0–1 decimal; null = store default */
  taxRate?: number | null
  taxComponents?: CatalogTaxComponent[]
  brand?: { id: string; name: string }
  category?: { id: string; name: string }
  brandId?: string
  categoryId?: string
  seo?: { slug?: string; metaTitle?: string; metaDescription?: string }
  status?: { isPublished?: boolean; visibility?: string; scheduledAt?: string | null }
  variants?: {
    name: string
    values: string[]
    defaultValue?: string
    valuePriceAdjustments?: Record<string, number>
  }[]
  media?: unknown[]
}

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

export async function fetchCatalogBrands(): Promise<CatalogBrand[]> {
  const q = new URLSearchParams({ limit: '200', offset: '0' })
  const raw = await request<unknown>(`/api/v1/catalog/brands?${q}`)
  return arrayFromPayload(raw, ['items', 'brands', 'data']) as CatalogBrand[]
}

export async function fetchCatalogCategories(): Promise<CatalogCategory[]> {
  const q = new URLSearchParams({ limit: '500', offset: '0' })
  const raw = await request<unknown>(`/api/v1/catalog/categories?${q}`)
  return arrayFromPayload(raw, ['items', 'categories', 'data']) as CatalogCategory[]
}

/** Admin list only; catalog fallback ignores publication (published storefront only). */
export type PublicationListFilter = 'all' | 'published' | 'unpublished'

export type CatalogProductListParams = {
  limit: number
  offset: number
  categoryId?: string
  brandId?: string
  search?: string
  /** Client-side hint; Nyra has no `GET /api/v1/products` — list data always comes from the public catalog. */
  publication?: PublicationListFilter
}

export async function fetchCatalogProducts(
  params: CatalogProductListParams,
): Promise<{ items: CatalogProductRow[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.categoryId) q.set('categoryId', params.categoryId)
  if (params.brandId) q.set('brandId', params.brandId)
  if (params.search) q.set('search', params.search)
  // Public catalog: no draft filter in Postman; params.publication ignored here.

  const raw = await request<unknown>(`/api/v1/catalog/products?${q}`)
  const rawItems = arrayFromPayload(raw, ['items', 'products', 'data'])
  const items = rawItems.map((row) => normalizeCatalogProductRow(row))
  const total = totalFromPayload(raw, items.length)
  return { items, total }
}

export async function fetchCatalogProductByKey(productKey: string): Promise<CatalogProductRow> {
  const encoded = encodeURIComponent(productKey)
  const raw = await request<unknown>(`/api/v1/catalog/products/${encoded}`, { method: 'GET' })
  return normalizeCatalogProductRow(raw)
}

export async function fetchProductByKey(
  token: string | null,
  productKey: string,
): Promise<CatalogProductRow> {
  const key = productKey.trim()
  if (token && key.startsWith('prd_')) {
    const encoded = encodeURIComponent(key)
    const raw = await request<unknown>(`/api/v1/products/${encoded}`, { method: 'GET', token })
    return normalizeCatalogProductRow(raw)
  }
  return fetchCatalogProductByKey(key)
}

/**
 * `GET /api/v1/catalog/products` only (Postman public catalog). Admin catalog documents `POST` / `PATCH`
 * for products, not a list endpoint — filtering by publication is applied client-side when the API ignores those query params.
 */
export async function fetchProductsList(
  token: string | null,
  params: CatalogProductListParams,
): Promise<{ items: CatalogProductRow[]; total: number }> {
  if (token) {
    const q = new URLSearchParams({
      limit: String(params.limit),
      offset: String(params.offset),
    })
    if (params.categoryId) q.set('categoryId', params.categoryId)
    if (params.brandId) q.set('brandId', params.brandId)
    if (params.search) q.set('search', params.search)
    if (params.publication && params.publication !== 'all') q.set('publication', params.publication)

    const raw = await request<unknown>(`/api/v1/products?${q}`, { method: 'GET', token })
    const rawItems = arrayFromPayload(raw, ['items', 'products', 'data'])
    const items = rawItems.map((row) => normalizeCatalogProductRow(row))
    const total = totalFromPayload(raw, items.length)
    return { items, total }
  }

  // Signed-out fallback: public catalog (published storefront only).
  const { items, total } = await fetchCatalogProducts(params)
  const pub = params.publication ?? 'all'
  if (pub === 'all') return { items, total }
  const filtered = items.filter((row) => {
    const published = row.status?.isPublished !== false
    return pub === 'published' ? published : !published
  })
  const fullPageKept = filtered.length === items.length
  return { items: filtered, total: fullPageKept ? total : filtered.length }
}

export function categoryBreadcrumb(
  categories: CatalogCategory[],
  categoryId: string | undefined,
): string {
  if (!categoryId) return '—'
  const byId = new Map(categories.map((c) => [c.id, c]))
  const parts: string[] = []
  let cur: CatalogCategory | undefined = byId.get(categoryId)
  const guard = new Set<string>()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    parts.unshift(cur.name)
    const p = cur.parentCategoryId
    cur = p ? byId.get(p) : undefined
  }
  const leaf = byId.get(categoryId)
  if (!parts.length && leaf) return leaf.name
  return parts.join(' › ') || '—'
}

/** All category ids in the subtree rooted at rootId (including root), for parent-picker exclusion. */
export function catalogCategorySubtreeIds(rootId: string, categories: CatalogCategory[]): Set<string> {
  const childrenByParent = new Map<string, string[]>()
  for (const c of categories) {
    const p = c.parentCategoryId?.trim() ?? ''
    if (!childrenByParent.has(p)) childrenByParent.set(p, [])
    childrenByParent.get(p)!.push(c.id)
  }
  const out = new Set<string>()
  const q = [rootId]
  while (q.length) {
    const id = q.shift()!
    if (out.has(id)) continue
    out.add(id)
    for (const kid of childrenByParent.get(id) ?? []) q.push(kid)
  }
  return out
}
