import { fetchProductByKey, type CatalogProductRow } from './catalog'
import { request } from './client'

export type ProductVariantInput = {
  name: string
  values: string[]
  /** Quick-add default; must be one of values when set */
  defaultValue?: string
  /** INR delta per value key (exact string as in values) */
  valuePriceAdjustments?: Record<string, number>
}

export type ProductSeoInput = {
  slug: string
  metaTitle: string
  metaDescription: string
}

export type ProductStatusInput = {
  isPublished: boolean
  visibility: string
  scheduledAt: string | null
}

export async function createProduct(
  token: string,
  formData: FormData,
): Promise<{ id: string } & Record<string, unknown>> {
  return request(`/api/v1/products`, { method: 'POST', token, body: formData })
}

export async function updateProduct(
  token: string,
  productId: string,
  body: Record<string, unknown> | FormData,
): Promise<unknown> {
  const encoded = encodeURIComponent(productId)
  return request(`/api/v1/products/${encoded}`, {
    method: 'PATCH',
    token,
    body,
  })
}

/** Use in PATCH bodies / mediaJson; catalog may return PascalCase (URL, Type, IsPrimary). */
export function normalizeProductMediaForApi(
  entries: unknown[],
): { url: string; type: string; isPrimary: boolean }[] {
  const out: { url: string; type: string; isPrimary: boolean }[] = []
  for (const m of entries) {
    if (!m || typeof m !== 'object') continue
    const o = m as Record<string, unknown>
    const url = o.url ?? o.URL
    if (typeof url !== 'string' || !url.trim()) continue
    const typeRaw = o.type ?? o.Type
    const type = typeof typeRaw === 'string' && typeRaw.trim() ? typeRaw : 'image'
    const ip = o.isPrimary ?? o.IsPrimary
    out.push({
      url: url.trim(),
      type,
      isPrimary: typeof ip === 'boolean' ? ip : ip === 'true',
    })
  }
  return out
}

function coerceVariantValuesForPatch(raw: unknown): string[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && 'value' in item) {
          const v = (item as { value?: unknown }).value
          return typeof v === 'string' ? v : v != null ? String(v) : ''
        }
        if (item && typeof item === 'object' && 'label' in item) {
          const v = (item as { label?: unknown }).label
          return typeof v === 'string' ? v : v != null ? String(v) : ''
        }
        return String(item)
      })
      .filter((s) => s.trim().length > 0)
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .map((x) => (typeof x === 'string' ? x : x != null ? String(x) : ''))
      .filter((s) => s.trim().length > 0)
  }
  return []
}

function coerceValuePriceAdjustmentsForPatch(
  raw: unknown,
): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

function variantsForProductPatch(
  row: CatalogProductRow,
): { name: string; values: string[]; defaultValue?: string; valuePriceAdjustments?: Record<string, number> }[] {
  if (!Array.isArray(row.variants)) return []
  return row.variants
    .map((v) => {
      const values = coerceVariantValuesForPatch((v as { values?: unknown }).values)
      const dvRaw = (v as { defaultValue?: unknown }).defaultValue
      const dv = typeof dvRaw === 'string' ? dvRaw.trim() : ''
      const name = typeof v?.name === 'string' ? v.name : ''
      const adj = coerceValuePriceAdjustmentsForPatch(
        (v as { valuePriceAdjustments?: unknown }).valuePriceAdjustments,
      )
      const out: {
        name: string
        values: string[]
        defaultValue?: string
        valuePriceAdjustments?: Record<string, number>
      } = { name, values }
      if (dv && values.includes(dv)) out.defaultValue = dv
      if (adj) {
        const filtered: Record<string, number> = {}
        for (const val of values) {
          if (typeof adj[val] === 'number' && Number.isFinite(adj[val])) {
            filtered[val] = adj[val]
          }
        }
        if (Object.keys(filtered).length) out.valuePriceAdjustments = filtered
      }
      return out
    })
    .filter((x) => x.name && x.values.length > 0)
}

export type ListRowProductAmend = {
  status?: Partial<ProductStatusInput>
  hasSpecialDiscount?: boolean
  isOutOfStock?: boolean
}

/**
 * Nyra PATCH /api/v1/products/:id expects a full product payload ("Full replacement fields" in Postman).
 * List/catalog rows usually include enough fields; partial PATCH bodies fail validation (e.g. "name is required").
 */
export function fullProductPatchFromListRow(
  row: CatalogProductRow,
  amend?: ListRowProductAmend,
): Record<string, unknown> {
  const brandId = row.brandId ?? row.brand?.id ?? ''
  const categoryId = row.categoryId ?? row.category?.id ?? ''
  const status: ProductStatusInput = {
    isPublished: row.status?.isPublished ?? true,
    visibility: row.status?.visibility ?? 'public',
    scheduledAt: row.status?.scheduledAt ?? null,
    ...amend?.status,
  }

  return {
    name: row.name?.trim() || 'Untitled product',
    description: row.description ?? '',
    brandId,
    categoryId,
    basePrice: row.basePrice ?? 0,
    discountPrice: row.discountPrice ?? 0,
    hasSpecialDiscount: amend?.hasSpecialDiscount ?? row.hasSpecialDiscount ?? false,
    discountExpiry: row.discountExpiry ?? null,
    sku: row.sku?.trim() || 'N/A',
    stockQuantity: row.stockQuantity ?? 0,
    isOutOfStock: amend?.isOutOfStock ?? row.isOutOfStock ?? false,
    media: normalizeProductMediaForApi(Array.isArray(row.media) ? row.media : []),
    variants: variantsForProductPatch(row),
    seo: {
      slug: row.seo?.slug ?? '',
      metaTitle: row.seo?.metaTitle ?? row.name ?? '',
      metaDescription: row.seo?.metaDescription ?? '',
    },
    status,
    taxRate: row.taxRate === undefined ? null : row.taxRate,
    taxComponents:
      row.taxComponents?.map((c) => ({ label: c.label, rate: c.rate })) ?? null,
  }
}

/** Loads the latest catalog shape (incl. media when API returns it), then PATCH with a full body. */
export async function patchProductFromCatalog(
  token: string,
  productId: string,
  amend?: ListRowProductAmend,
): Promise<unknown> {
  const row = await fetchProductByKey(token, productId)
  return updateProduct(token, productId, fullProductPatchFromListRow(row, amend))
}

/** Nyra POST/PATCH send `basePrice` / `discountPrice` as whole rupees (see multipart `basePrice="4999"`). */
export function parseInrInputToRupees(raw: string): number {
  const n = Number.parseFloat(raw.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n)
}

export function rupeesToFormString(rupees: number | undefined | null): string {
  if (rupees === undefined || rupees === null || !Number.isFinite(rupees)) return ''
  return String(rupees)
}

/** `en-IN` currency (₹) for whole-rupee amounts from the API. */
export function formatInr(rupees: number | undefined | null): string {
  if (rupees === undefined || rupees === null || !Number.isFinite(rupees)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rupees)
}
