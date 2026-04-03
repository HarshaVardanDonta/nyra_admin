import { fetchCatalogProductByKey, type CatalogProductRow } from './catalog'
import { request } from './client'

export type ProductVariantInput = { name: string; values: string[] }

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
  body: Record<string, unknown>,
): Promise<unknown> {
  const encoded = encodeURIComponent(productId)
  return request(`/api/v1/products/${encoded}`, {
    method: 'PATCH',
    token,
    body,
  })
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

function variantsForProductPatch(row: CatalogProductRow): { name: string; values: string[] }[] {
  if (!Array.isArray(row.variants)) return []
  return row.variants
    .map((v) => ({
      name: typeof v?.name === 'string' ? v.name : '',
      values: coerceVariantValuesForPatch((v as { values?: unknown }).values),
    }))
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
    media: Array.isArray(row.media) ? row.media : [],
    variants: variantsForProductPatch(row),
    seo: {
      slug: row.seo?.slug ?? '',
      metaTitle: row.seo?.metaTitle ?? row.name ?? '',
      metaDescription: row.seo?.metaDescription ?? '',
    },
    status,
  }
}

/** Loads the latest catalog shape (incl. media when API returns it), then PATCH with a full body. */
export async function patchProductFromCatalog(
  token: string,
  productId: string,
  amend?: ListRowProductAmend,
): Promise<unknown> {
  const row = await fetchCatalogProductByKey(productId)
  return updateProduct(token, productId, fullProductPatchFromListRow(row, amend))
}

/** Cents from dollar input string */
export function dollarsToCents(raw: string): number {
  const n = Number.parseFloat(raw.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export function centsToDollarsString(cents: number | undefined | null): string {
  if (cents === undefined || cents === null || !Number.isFinite(cents)) return ''
  return (cents / 100).toFixed(2)
}
