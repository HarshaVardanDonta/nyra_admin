import { ApiError } from './errors'
import { request } from './client'

export type RelatedBlogRow = {
  id: string
  title: string
  slug: string
  tagOverlap: number
  createdAt: string
  isPublished: boolean
}

/** Linked product summary from blog detail API (`products` array). */
export type BlogProductEmbed = {
  id: string
  name: string
  sku: string
  imageUrl: string
  slug: string
  isPublished: boolean
  missing?: boolean
}

export type BlogRecord = {
  id: string
  title: string
  body: string
  slug: string
  isPublished: boolean
  tags: string[]
  productIds: string[]
  /** Populated on detail fetch when the blog has linked products. */
  products: BlogProductEmbed[]
  relatedBlogs: RelatedBlogRow[]
  createdAt: string
  updatedAt: string
}

export type BlogSummary = {
  id: string
  title: string
  slug: string
  isPublished: boolean
  tags: string[]
  createdAt: string
}

export type BlogAnalytics = {
  viewsLast7Days: number
  viewsLast30Days: number
  viewsLast365Days: number
  viewsAllTime: number
}

export type PopularBlogRow = {
  id: string
  title: string
  slug: string
  viewCount: number
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string') return v
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

function normalizeRelated(raw: unknown): RelatedBlogRow {
  if (!raw || typeof raw !== 'object') {
    return { id: '', title: '', slug: '', tagOverlap: 0, createdAt: '', isPublished: false }
  }
  const o = raw as Record<string, unknown>
  const overlap = o.tagOverlap ?? o.tag_overlap
  return {
    id: pickStr(o, 'id', 'Id') ?? '',
    title: pickStr(o, 'title', 'Title') ?? '',
    slug: pickStr(o, 'slug', 'Slug') ?? '',
    tagOverlap: typeof overlap === 'number' && Number.isFinite(overlap) ? overlap : 0,
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    isPublished: pickBool(o, 'isPublished', 'is_published') === true,
  }
}

export function normalizeBlog(raw: unknown): BlogRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      id: '',
      title: '',
      body: '',
      slug: '',
      isPublished: false,
      tags: [],
      productIds: [],
      products: [],
      relatedBlogs: [],
      createdAt: '',
      updatedAt: '',
    }
  }
  const o = raw as Record<string, unknown>
  const tags: string[] = []
  const t = o.tags ?? o.Tags
  if (Array.isArray(t)) {
    for (const x of t) {
      if (typeof x === 'string' && x.trim()) tags.push(x)
    }
  }
  const pids: string[] = []
  const pi = o.productIds ?? o.product_ids
  if (Array.isArray(pi)) {
    for (const x of pi) {
      if (typeof x === 'string' && x.trim()) pids.push(x)
    }
  }
  const rel: RelatedBlogRow[] = []
  const rb = o.relatedBlogs ?? o.related_blogs
  if (Array.isArray(rb)) {
    for (const x of rb) rel.push(normalizeRelated(x))
  }
  const products: BlogProductEmbed[] = []
  const pr = o.products ?? o.Products
  if (Array.isArray(pr)) {
    for (const x of pr) {
      if (!x || typeof x !== 'object') continue
      const po = x as Record<string, unknown>
      products.push({
        id: pickStr(po, 'id', 'Id') ?? '',
        name: pickStr(po, 'name', 'Name') ?? '',
        sku: pickStr(po, 'sku', 'SKU') ?? '',
        imageUrl: pickStr(po, 'imageUrl', 'image_url') ?? '',
        slug: pickStr(po, 'slug', 'Slug') ?? '',
        isPublished: pickBool(po, 'isPublished', 'is_published') === true,
        missing: pickBool(po, 'missing', 'Missing') === true,
      })
    }
  }
  return {
    id: pickStr(o, 'id', 'Id') ?? '',
    title: pickStr(o, 'title', 'Title') ?? '',
    body: pickStr(o, 'body', 'Body') ?? '',
    slug: pickStr(o, 'slug', 'Slug') ?? '',
    isPublished: pickBool(o, 'isPublished', 'is_published') === true,
    tags,
    productIds: pids,
    products,
    relatedBlogs: rel,
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    updatedAt: pickStr(o, 'updatedAt', 'updated_at') ?? '',
  }
}

function normalizeSummary(raw: unknown): BlogSummary {
  if (!raw || typeof raw !== 'object') {
    return { id: '', title: '', slug: '', isPublished: false, tags: [], createdAt: '' }
  }
  const o = raw as Record<string, unknown>
  const tags: string[] = []
  const t = o.tags ?? o.Tags
  if (Array.isArray(t)) {
    for (const x of t) {
      if (typeof x === 'string' && x.trim()) tags.push(x)
    }
  }
  return {
    id: pickStr(o, 'id', 'Id') ?? '',
    title: pickStr(o, 'title', 'Title') ?? '',
    slug: pickStr(o, 'slug', 'Slug') ?? '',
    isPublished: pickBool(o, 'isPublished', 'is_published') === true,
    tags,
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
  }
}

export type BlogWriteInput = {
  title: string
  body: string
  slug: string
  isPublished: boolean
  tags: string[]
  productIds: string[]
}

export async function fetchBlogsList(
  token: string | null,
  params: { limit: number; offset: number; tag?: string; search?: string },
): Promise<{ items: BlogSummary[]; total: number }> {
  const q = new URLSearchParams({
    limit: String(params.limit),
    offset: String(params.offset),
  })
  if (params.tag?.trim()) q.set('tag', params.tag.trim())
  if (params.search?.trim()) q.set('search', params.search.trim())
  const raw = await request<unknown>(`/api/v1/blogs?${q}`, { method: 'GET', token })
  const items: BlogSummary[] = []
  let total = 0
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    const arr = o.blogs
    if (Array.isArray(arr)) {
      for (const row of arr) items.push(normalizeSummary(row))
    }
    const t = o.total
    if (typeof t === 'number' && Number.isFinite(t)) total = t
  }
  return { items, total }
}

export async function fetchBlogDetail(token: string | null, blogId: string): Promise<BlogRecord> {
  const enc = encodeURIComponent(blogId)
  const raw = await request<unknown>(`/api/v1/blogs/${enc}`, { method: 'GET', token })
  return normalizeBlog(raw)
}

export async function fetchBlogAnalytics(token: string | null, blogId: string): Promise<BlogAnalytics> {
  const enc = encodeURIComponent(blogId)
  const raw = await request<Record<string, unknown>>(`/api/v1/blogs/${enc}/analytics`, {
    method: 'GET',
    token,
  })
  return {
    viewsLast7Days: typeof raw.viewsLast7Days === 'number' ? raw.viewsLast7Days : 0,
    viewsLast30Days: typeof raw.viewsLast30Days === 'number' ? raw.viewsLast30Days : 0,
    viewsLast365Days: typeof raw.viewsLast365Days === 'number' ? raw.viewsLast365Days : 0,
    viewsAllTime: typeof raw.viewsAllTime === 'number' ? raw.viewsAllTime : 0,
  }
}

export async function fetchPopularBlogs(
  token: string | null,
  period: 'week' | 'month' | 'year',
  limit = 8,
): Promise<PopularBlogRow[]> {
  const q = new URLSearchParams({ period, limit: String(limit) })
  const raw = await request<unknown>(`/api/v1/blogs/popular?${q}`, { method: 'GET', token })
  const out: PopularBlogRow[] = []
  if (raw && typeof raw === 'object') {
    const arr = (raw as Record<string, unknown>).blogs
    if (Array.isArray(arr)) {
      for (const row of arr) {
        if (!row || typeof row !== 'object') continue
        const o = row as Record<string, unknown>
        const vc = o.viewCount ?? o.view_count
        out.push({
          id: pickStr(o, 'id', 'Id') ?? '',
          title: pickStr(o, 'title', 'Title') ?? '',
          slug: pickStr(o, 'slug', 'Slug') ?? '',
          viewCount: typeof vc === 'number' && Number.isFinite(vc) ? vc : 0,
        })
      }
    }
  }
  return out
}

function buildBlogBody(input: BlogWriteInput): Record<string, unknown> {
  return {
    title: input.title.trim(),
    body: input.body,
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, '-'),
    isPublished: input.isPublished,
    tags: input.tags,
    productIds: input.productIds,
  }
}

export async function createBlog(token: string, input: BlogWriteInput): Promise<BlogRecord> {
  const raw = await request<unknown>('/api/v1/blogs', {
    method: 'POST',
    token,
    body: buildBlogBody(input),
  })
  return normalizeBlog(raw)
}

export async function updateBlog(token: string, blogId: string, input: BlogWriteInput): Promise<BlogRecord> {
  const enc = encodeURIComponent(blogId)
  const raw = await request<unknown>(`/api/v1/blogs/${enc}`, {
    method: 'PUT',
    token,
    body: buildBlogBody(input),
  })
  return normalizeBlog(raw)
}

export async function deleteBlog(token: string | null, blogId: string): Promise<void> {
  const enc = encodeURIComponent(blogId)
  await request(`/api/v1/blogs/${enc}`, { method: 'DELETE', token })
}

/** Distinct tag names for blog editor autocomplete (admin). */
/** Upload a blog body image to Cloudflare R2 (admin); returns public URL. */
export async function uploadBlogBodyImage(token: string, file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const raw = await request<unknown>('/api/v1/blogs/upload-image', {
    method: 'POST',
    token,
    body: fd,
  })
  if (!raw || typeof raw !== 'object') {
    throw new ApiError('Invalid upload response', 500)
  }
  const url = (raw as Record<string, unknown>).url
  if (typeof url !== 'string' || !url.trim()) {
    throw new ApiError('Upload response missing url', 500)
  }
  return url.trim()
}

export async function fetchBlogTagNames(token: string | null, limit = 500): Promise<string[]> {
  const q = new URLSearchParams({ limit: String(limit) })
  const raw = await request<unknown>(`/api/v1/blogs/tag-names?${q}`, { method: 'GET', token })
  if (!raw || typeof raw !== 'object') return []
  const arr = (raw as Record<string, unknown>).tags
  if (!Array.isArray(arr)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const x of arr) {
    if (typeof x !== 'string') continue
    const n = x.trim().toLowerCase()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}
