import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { deleteBrand, fetchBrandDetail, type BrandRecord } from '../lib/api/brands'
import {
  categoryBreadcrumb,
  fetchCatalogCategories,
  fetchProductsList,
  type CatalogCategory,
  type CatalogProductRow,
} from '../lib/api/catalog'
import { resolveMediaUrl } from '../lib/media-url'

function formatInrFromCents(cents: number | undefined | null) {
  if (cents === undefined || cents === null || !Number.isFinite(cents)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function stockStatus(row: CatalogProductRow): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (row.isOutOfStock) return 'out_of_stock'
  const q = row.stockQuantity ?? 0
  if (q <= 0) return 'out_of_stock'
  if (q < 15) return 'low_stock'
  return 'in_stock'
}

function stockDotClass(s: ReturnType<typeof stockStatus>) {
  switch (s) {
    case 'in_stock':
      return 'bg-emerald-500'
    case 'low_stock':
      return 'bg-amber-500'
    case 'out_of_stock':
      return 'bg-red-500'
    default:
      return 'bg-slate-400'
  }
}

function stockLabel(row: CatalogProductRow) {
  const s = stockStatus(row)
  const q = row.stockQuantity ?? 0
  switch (s) {
    case 'in_stock':
      return `In stock (${formatInt(q)})`
    case 'low_stock':
      return `Low stock (${formatInt(q)})`
    case 'out_of_stock':
      return 'Out of stock'
    default:
      return '—'
  }
}

export function BrandDetailPage() {
  const { brandId } = useParams<{ brandId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [brand, setBrand] = useState<BrandRecord | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [products, setProducts] = useState<CatalogProductRow[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const [b, cats, plist] = await Promise.all([
        fetchBrandDetail(token, brandId),
        fetchCatalogCategories().catch(() => [] as CatalogCategory[]),
        fetchProductsList(token, {
          limit: 24,
          offset: 0,
          brandId,
          publication: 'all',
        }),
      ])
      setBrand(b)
      setCategories(cats)
      setProducts(plist.items)
      setProductTotal(plist.total)
    } catch (e) {
      showApiError(e)
      setBrand(null)
      setProducts([])
      setProductTotal(0)
    } finally {
      setLoading(false)
    }
  }, [brandId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  const kpis = (() => {
    const list = products
    const n = list.length
    const units = list.reduce((acc, p) => acc + (p.stockQuantity ?? 0), 0)
    const prices = list.map((p) => p.basePrice).filter((x): x is number => typeof x === 'number' && x > 0)
    const avg =
      prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null
    return {
      productSample: n,
      units,
      avgCents: avg,
    }
  })()

  async function handleDelete() {
    if (!token || !brandId) {
      showToast('Sign in to delete brands.', 'error')
      return
    }
    if (!window.confirm('Delete this brand? This may fail if the API does not support DELETE.')) return
    setDeleting(true)
    try {
      const ok = await deleteBrand(token, brandId)
      if (ok) {
        showToast('Brand deleted.', 'success')
        navigate('/brands')
      } else {
        showToast('Delete is not supported by the API.', 'error')
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !brand) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Brand not found.'}
      </div>
    )
  }

  const active = brand.isActive !== false
  const logo = brand.logoUrl ? resolveMediaUrl(brand.logoUrl) : ''
  const banner = brand.bannerUrl ? resolveMediaUrl(brand.bannerUrl) : ''

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <nav className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/brands" className="hover:text-blue-600 dark:hover:text-blue-400">
          Brands
        </Link>
        <span className="mx-2">›</span>
        <span className="text-slate-800 dark:text-slate-200">{brand.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
            {logo ? (
              <img src={logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-bold text-slate-400">{brand.name.slice(0, 2).toUpperCase()}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{brand.name}</h1>
              <span
                className={
                  active
                    ? 'rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
                    : 'rounded-full border border-red-500/40 bg-red-950/50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-300'
                }
              >
                {active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {brand.description ? (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{brand.description}</p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-slate-500 dark:text-slate-500">ID: {brand.id}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/brands/${encodeURIComponent(brand.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit brand
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Products (sample)</p>
            <span className="text-blue-600 dark:text-blue-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(kpis.productSample)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatInt(productTotal)} total · first page loaded
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Units in stock (sample)</p>
            <span className="text-blue-600 dark:text-blue-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(kpis.units)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Summed from loaded products</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg. list price (sample)</p>
            <span className="text-blue-600 dark:text-blue-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{formatInrFromCents(kpis.avgCents)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mean base price on this page</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Brand information</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {brand.description || 'No description yet.'}
            </p>
            {brand.websiteUrl ? (
              <a
                href={brand.websiteUrl.startsWith('http') ? brand.websiteUrl : `https://${brand.websiteUrl}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {brand.websiteUrl.replace(/^https?:\/\//, '')}
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-800">
              <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-400">
                <span>Products (reported)</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {brand.productCount != null ? formatInt(brand.productCount) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-slate-600 dark:text-slate-400">
                <span>Featured</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {brand.isFeatured ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Brand assets</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                {logo ? (
                  <img src={logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">Logo</div>
                )}
              </div>
              <div className="aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                {banner ? (
                  <img src={banner} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-400">Banner</div>
                )}
              </div>
              <Link
                to={`/brands/${encodeURIComponent(brand.id)}/edit`}
                className="col-span-2 flex aspect-[2/1] items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm font-medium text-blue-600 transition hover:border-blue-500/50 dark:border-slate-600 dark:text-blue-400"
              >
                + Upload / replace in editor
              </Link>
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Recent products
            </h2>
            <Link to={`/products?brandId=${encodeURIComponent(brand.id)}`} className="text-sm font-medium text-blue-600 dark:text-blue-400">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                      No products for this brand on the first page.
                    </td>
                  </tr>
                ) : (
                  products.map((row) => {
                    const thumb = row.thumbnailUrl ? resolveMediaUrl(row.thumbnailUrl) : ''
                    const cat = categoryBreadcrumb(categories, row.category?.id ?? row.categoryId)
                    const st = stockStatus(row)
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                              {thumb ? (
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                            {cat}
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatInrFromCents(row.basePrice)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-xs">
                            <span className={`h-2 w-2 rounded-full ${stockDotClass(st)}`} aria-hidden />
                            {stockLabel(row)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/products/${encodeURIComponent(row.id)}/edit`}
                            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
          {products.length > 0 && productTotal > products.length ? (
            <div className="border-t border-slate-100 px-4 py-3 text-center dark:border-slate-800">
              <Link
                to={`/products?brandId=${encodeURIComponent(brand.id)}`}
                className="text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                Load more in Products
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
