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
  for (const k of ['id', 'categoryId', '_id']) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
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

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

function unwrapCategoryObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const innerKeys = ['data', 'category', 'item', 'result', 'payload', 'body']
  for (const k of innerKeys) {
    const inner = o[k]
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const io = inner as Record<string, unknown>
      if (pickId(io)) return io
    }
  }
  return o
}

export type CategoryRecord = {
  id: string
  name: string
  slug?: string
  description?: string
  parentCategoryId?: string | null
  /** Resolved parent display name when list payload includes it */
  parentName?: string
  displayOrder?: number
  isActive?: boolean
  thumbnailUrl?: string
  bannerUrl?: string
  productCount?: number
  updatedAt?: string
}

export function normalizeCategoryRow(raw: unknown): CategoryRecord | null {
  const o = unwrapCategoryObject(raw)
  if (!o) return null
  const id = pickId(o)
  if (!id) return null
  const name =
    pickStr(o, 'name', 'title', 'categoryName') ?? pickStr(o, 'slug') ?? 'Untitled category'

  const parentObj = o.parentCategory ?? o.parent
  let parentCategoryId: string | null | undefined
  let parentName: string | undefined
  if (parentObj && typeof parentObj === 'object' && !Array.isArray(parentObj)) {
    const po = parentObj as Record<string, unknown>
    const pid = pickId(po)
    if (pid) parentCategoryId = pid
    parentName = pickStr(po, 'name', 'title')
  }
  if (parentCategoryId === undefined) {
    const p = o.parentCategoryId ?? o.parentId ?? o.parent_id
    if (p === null) parentCategoryId = null
    else if (typeof p === 'string' && p.trim()) parentCategoryId = p.trim()
    else if (typeof p === 'number' && Number.isFinite(p)) parentCategoryId = String(p)
  }
  if (!parentName) {
    parentName = pickStr(o, 'parentName', 'parent_category_name', 'parentCategoryName')
  }

  return {
    id,
    name,
    slug: pickStr(o, 'slug'),
    description: pickStr(o, 'description', 'summary'),
    parentCategoryId,
    parentName,
    displayOrder: pickNum(o, 'displayOrder', 'display_order', 'sortOrder'),
    isActive: pickBool(o, 'isActive', 'active', 'is_active'),
    thumbnailUrl: pickStr(o, 'thumbnailUrl', 'thumbnail', 'imageUrl', 'logoUrl'),
    bannerUrl: pickStr(o, 'bannerUrl', 'banner'),
    productCount: pickNum(o, 'productCount', 'productsCount', 'product_count', 'itemsCount'),
    updatedAt: pickStr(o, 'updatedAt', 'updated_at', 'modifiedAt'),
  }
}

function mapListItems(raw: unknown): CategoryRecord[] {
  const arr = arrayFromPayload(raw, ['items', 'categories', 'data', 'results'])
  const out: CategoryRecord[] = []
  for (const item of arr) {
    const row = normalizeCategoryRow(item)
    if (row) out.push(row)
  }
  return out
}

export type CategoryListParams = {
  limit: number
  offset: number
  search?: string
  status?: 'all' | 'active' | 'inactive'
  /** Omit = all parents. `"root"` = top-level only. Otherwise a `cat_*` parent id. */
  parentScope?: string
}

/**
 * Prefer `GET /api/v1/categories` when the admin stack exposes it; otherwise load the public
 * catalog tree and filter client-side (search / status / parent).
 */
export async function fetchCategoriesList(
  token: string | null,
  params: CategoryListParams,
): Promise<{ items: CategoryRecord[]; total: number }> {
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
  const scope = params.parentScope
  if (scope === 'root') q.set('root', 'true')
  else if (scope && scope !== 'all') q.set('parentId', scope)

  if (token) {
    try {
      const raw = await request<unknown>(`/api/v1/categories?${q}`, { method: 'GET', token })
      const items = mapListItems(raw)
      const total = totalFromPayload(raw, items.length)
      return { items, total }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        /* catalog fallback */
      } else {
        throw e
      }
    }
  }

  const cq = new URLSearchParams({ limit: '500', offset: '0' })
  if (scope === 'root') cq.set('root', 'true')
  else if (scope && scope !== 'all') cq.set('parentId', scope)
  const raw = await request<unknown>(`/api/v1/catalog/categories?${cq}`, { method: 'GET' })
  let items = mapListItems(raw)
  const search = params.search?.trim().toLowerCase()
  if (search) {
    items = items.filter((c) => {
      const hay = `${c.name} ${c.slug ?? ''}`.toLowerCase()
      return hay.includes(search)
    })
  }
  if (st === 'active') items = items.filter((c) => c.isActive !== false)
  if (st === 'inactive') items = items.filter((c) => c.isActive === false)
  if (scope === 'root') {
    items = items.filter((c) => !c.parentCategoryId)
  }
  const total = items.length
  const start = params.offset
  const end = start + params.limit
  return { items: items.slice(start, end), total }
}

export async function fetchCategoryDetail(token: string | null, categoryKey: string): Promise<CategoryRecord> {
  const encoded = encodeURIComponent(categoryKey)
  let lastCatalogErr: unknown
  if (token) {
    try {
      const raw = await request<unknown>(`/api/v1/categories/${encoded}`, { method: 'GET', token })
      const row = normalizeCategoryRow(raw)
      if (row) return row
    } catch (e) {
      if (!(e instanceof ApiError && (e.status === 404 || e.status === 405))) {
        throw e
      }
    }
  }
  try {
    const raw = await request<unknown>(`/api/v1/catalog/categories/${encoded}`, { method: 'GET' })
    const row = normalizeCategoryRow(raw)
    if (row) return row
  } catch (e) {
    lastCatalogErr = e
  }
  if (token) {
    try {
      const { items } = await fetchCategoriesList(token, { limit: 500, offset: 0 })
      const hit = items.find((c) => c.id === categoryKey || c.slug === categoryKey)
      if (hit) return hit
    } catch {
      /* ignore */
    }
  }
  if (lastCatalogErr instanceof ApiError) throw lastCatalogErr
  throw new ApiError('Category not found', 404)
}

/** Direct children for detail / subcategory list (catalog supports `parentId`). */
export async function fetchChildCategories(parentCategoryId: string): Promise<CategoryRecord[]> {
  const q = new URLSearchParams({ limit: '200', offset: '0', parentId: parentCategoryId })
  const raw = await request<unknown>(`/api/v1/catalog/categories?${q}`, { method: 'GET' })
  return mapListItems(raw)
}

export async function createCategory(token: string, formData: FormData): Promise<Record<string, unknown>> {
  return request(`/api/v1/categories`, { method: 'POST', token, body: formData })
}

export function categoryIdFromCreateResponse(res: unknown): string {
  const row = normalizeCategoryRow(res)
  if (row?.id) return row.id
  if (res && typeof res === 'object') {
    const o = res as Record<string, unknown>
    const direct = pickId(o)
    if (direct) return direct
  }
  return ''
}

async function requestCategoryUpdate(
  token: string,
  categoryId: string,
  body: Record<string, unknown> | FormData,
): Promise<unknown> {
  const encoded = encodeURIComponent(categoryId)
  const attempts: { method: string; path: string }[] = [
    { method: 'PATCH', path: `/api/v1/categories/${encoded}` },
    { method: 'PUT', path: `/api/v1/categories/${encoded}` },
    { method: 'PATCH', path: `/api/v1/catalog/categories/${encoded}` },
    { method: 'PUT', path: `/api/v1/catalog/categories/${encoded}` },
  ]
  let lastErr: unknown
  for (const { method, path } of attempts) {
    try {
      return await request(path, { method, token, body })
    } catch (e) {
      lastErr = e
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) continue
      throw e
    }
  }
  throw lastErr
}

export async function updateCategoryJson(
  token: string,
  categoryId: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  return requestCategoryUpdate(token, categoryId, body)
}

export async function updateCategoryMultipart(
  token: string,
  categoryId: string,
  formData: FormData,
): Promise<unknown> {
  return requestCategoryUpdate(token, categoryId, formData)
}

export async function deleteCategory(token: string, categoryId: string): Promise<boolean> {
  const encoded = encodeURIComponent(categoryId)
  try {
    await request(`/api/v1/categories/${encoded}`, { method: 'DELETE', token })
    return true
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 405)) return false
    throw e
  }
}
