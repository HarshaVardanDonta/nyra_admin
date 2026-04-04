import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  collectionSlugSegment,
  deleteCollection,
  fetchCollectionAnalytics,
  fetchCollectionDetail,
  type CollectionAnalytics,
  type CollectionRecord,
  updateCollection,
  type CollectionWriteBody,
} from '../lib/api/collections'
import { categoryBreadcrumb, fetchCatalogCategories, type CatalogCategory } from '../lib/api/catalog'
import { formatInr } from '../lib/api/products'
import { resolveMediaUrl } from '../lib/media-url'

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatCompact(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function toWriteBody(c: CollectionRecord): CollectionWriteBody {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description,
    bannerImageUrl: c.bannerImageUrl,
    thumbnailUrl: c.thumbnailUrl,
    displayAsStrip: c.displayAsStrip,
    displayPriority: c.displayPriority,
    status: c.status,
  }
}

function stockBarClass(stock: number, oos: boolean) {
  if (oos || stock <= 0) return 'bg-slate-700'
  if (stock <= 12) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function stockWidthPct(stock: number, oos: boolean) {
  if (oos || stock <= 0) return 4
  return Math.min(100, Math.max(12, Math.round((stock / 160) * 100)))
}

export function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [collection, setCollection] = useState<CollectionRecord | null>(null)
  const [analytics, setAnalytics] = useState<CollectionAnalytics | null>(null)
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [stripSaving, setStripSaving] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const perPage = 4

  const reload = useCallback(async () => {
    if (!collectionId) return
    setLoading(true)
    try {
      const [col, cats, an] = await Promise.all([
        fetchCollectionDetail(token, collectionId),
        fetchCatalogCategories().catch(() => [] as CatalogCategory[]),
        fetchCollectionAnalytics(token, collectionId).catch(() => null),
      ])
      setCollection(col)
      setCategories(cats)
      setAnalytics(an)
    } catch (e) {
      showApiError(e)
      setCollection(null)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [collectionId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setProductPage(1)
  }, [productSearch])

  const filteredProducts = useMemo(() => {
    if (!collection?.products?.length) return []
    const q = productSearch.trim().toLowerCase()
    if (!q) return collection.products
    return collection.products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        p.id.toLowerCase().includes(q),
    )
  }, [collection?.products, productSearch])

  const pagedProducts = useMemo(() => {
    const start = (productPage - 1) * perPage
    return filteredProducts.slice(start, start + perPage)
  }, [filteredProducts, productPage])

  const productPages = Math.max(1, Math.ceil(filteredProducts.length / perPage))

  async function handleDelete() {
    if (!token || !collectionId || !collection) return
    if (!window.confirm(`Delete collection “${collection.name}”?`)) return
    setDeleting(true)
    try {
      await deleteCollection(token, collectionId)
      showToast('Collection deleted.', 'success')
      navigate('/collections')
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  async function toggleStrip(next: boolean) {
    if (!token || !collection) return
    setStripSaving(true)
    const body = { ...toWriteBody(collection), displayAsStrip: next }
    try {
      const updated = await updateCollection(token, collection.id, body)
      setCollection(updated)
      showToast(next ? 'Shown on homepage strip.' : 'Removed from homepage strip.', 'success')
    } catch (e) {
      showApiError(e)
    } finally {
      setStripSaving(false)
    }
  }

  if (loading || !collection) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-[#0b0e14] text-sm text-slate-500">
        {loading ? 'Loading…' : 'Collection not found.'}
      </div>
    )
  }

  const published = collection.status.toLowerCase() === 'published'
  const banner = collection.bannerImageUrl ? resolveMediaUrl(collection.bannerImageUrl) : ''
  const seg = collectionSlugSegment(collection.slug)

  return (
    <div className="min-h-full bg-[#0b0e14] p-6 pb-28 text-slate-200 lg:p-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link to="/collections" className="hover:text-blue-400">
          Collections
        </Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-blue-400">{collection.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">{collection.name}</h1>
          {published ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ACTIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
              DRAFT
            </span>
          )}
          {collection.displayAsStrip ? (
            <span className="rounded-md bg-blue-600/25 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
              FEATURED ON HOME
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/collections/${encodeURIComponent(collection.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#151b23] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50"
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

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#151b23] shadow-xl">
            <div
              className={`relative flex min-h-[200px] flex-col justify-end bg-gradient-to-br from-slate-800 to-slate-900 p-8 ${
                banner ? '' : ''
              }`}
            >
              {banner ? (
                <>
                  <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0e14] via-transparent to-transparent" />
                </>
              ) : null}
              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Banner preview
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">{collection.name}</h2>
              </div>
            </div>
            <div className="border-t border-slate-800 p-6">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-blue-400/90">Description</p>
              {collection.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                  {collection.description}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No description.</p>
              )}
              <div className="mt-6 grid gap-4 border-t border-slate-800 pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Created</p>
                  <p className="mt-1 text-sm text-slate-200">{formatDate(collection.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total products</p>
                  <p className="mt-1 text-sm text-slate-200">{collection.products.length} items</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Slug</p>
                  <p className="mt-1 font-mono text-sm text-slate-400">{seg || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#151b23] shadow-xl">
            <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Products in collection</h3>
                <p className="text-sm text-slate-500">{collection.products.length} total items</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="relative flex-1 min-w-[200px]">
                  <span className="sr-only">Search</span>
                  <svg
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
                  </svg>
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search items…"
                    className="w-full rounded-lg border border-slate-700 bg-[#0f1419] py-2.5 pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </label>
                <Link
                  to={`/collections/${encodeURIComponent(collection.id)}/edit`}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500"
                >
                  + Add product
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Price</th>
                    <th className="px-5 py-3">Stock</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {pagedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                        No matching products.
                      </td>
                    </tr>
                  ) : (
                    pagedProducts.map((p) => {
                      const thumb = p.thumbnailUrl ? resolveMediaUrl(p.thumbnailUrl) : ''
                      const oos = p.isOutOfStock === true || (p.stockQuantity ?? 0) <= 0
                      const stock = p.stockQuantity ?? 0
                      const catLabel = categoryBreadcrumb(categories, p.categoryId)
                      return (
                        <tr key={p.id} className="hover:bg-slate-800/30">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-800">
                                {thumb ? (
                                  <img src={thumb} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-600">
                                    —
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-white">{p.name}</p>
                                <p className="truncate text-xs text-slate-500">{catLabel}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 font-mono text-xs text-slate-400">{p.sku ?? '—'}</td>
                          <td className="px-5 py-4 text-slate-200">{formatInr(p.basePrice)}</td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className={`h-full rounded-full transition-all ${stockBarClass(stock, oos)}`}
                                  style={{ width: `${stockWidthPct(stock, oos)}%` }}
                                />
                              </div>
                              {oos ? (
                                <span className="text-xs font-medium text-red-400">Out of stock</span>
                              ) : (
                                <span className="text-xs tabular-nums text-slate-400">{stock}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              to={`/products/${encodeURIComponent(p.id)}/edit`}
                              className="inline-flex rounded-lg p-2 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                              title="Edit product"
                            >
                              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                />
                              </svg>
                            </Link>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 text-sm text-slate-500 sm:flex-row">
              <p className="tabular-nums">
                Showing {filteredProducts.length ? (productPage - 1) * perPage + 1 : 0}–
                {Math.min(productPage * perPage, filteredProducts.length)} of {filteredProducts.length} products
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={productPage <= 1}
                  onClick={() => setProductPage((x) => Math.max(1, x - 1))}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs">
                  {productPage} / {productPages}
                </span>
                <button
                  type="button"
                  disabled={productPage >= productPages}
                  onClick={() => setProductPage((x) => x + 1)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-[#151b23] p-5 shadow-xl">
            <div className="flex items-center gap-2 text-white">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
              <h3 className="font-semibold">Homepage visibility</h3>
            </div>
            <p className="mt-3 text-sm text-slate-500">Show this collection as a scrollable row on the homepage.</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={collection.displayAsStrip}
                disabled={stripSaving}
                onClick={() => void toggleStrip(!collection.displayAsStrip)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  collection.displayAsStrip ? 'bg-blue-600' : 'bg-slate-600'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 left-1 block h-5 w-5 rounded-full bg-white shadow transition ${
                    collection.displayAsStrip ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
            <p className="mt-4 text-sm text-blue-400">
              Priority {collection.displayPriority}
              {collection.displayAsStrip ? ' · Hero slot order' : ''}
            </p>
            <p className="mt-1 text-xs text-slate-500">Lower numbers appear first in the storefront strip.</p>
            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-lg border border-slate-700 py-2 text-sm text-slate-500"
              title="Layout tooling is not wired yet"
            >
              Manage homepage layout
            </button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#151b23] p-5 shadow-xl">
            <div className="flex items-center gap-2 text-white">
              <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M9 19v-6m5 6V9m5 10V4" />
              </svg>
              <h3 className="font-semibold">Performance</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Illustrative metrics for UI preview (not live analytics yet).
            </p>
            {analytics ? (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-[#0f1419] p-3">
                  <p className="text-xs text-slate-500">Views</p>
                  <p className="mt-1 text-lg font-semibold text-white">{formatCompact(analytics.views)}</p>
                  <p className="text-xs text-emerald-400">+{analytics.viewsTrendPercent}%</p>
                </div>
                <div className="rounded-lg bg-[#0f1419] p-3">
                  <p className="text-xs text-slate-500">Sales</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {formatInr(analytics.salesCents / 100)}
                  </p>
                  <p className="text-xs text-emerald-400">+{analytics.salesTrendPercent}%</p>
                </div>
                <div className="col-span-2 rounded-lg bg-[#0f1419] p-3">
                  <p className="text-xs text-slate-500">Conversion rate</p>
                  <div className="mt-2 flex items-end gap-2">
                    <p className="text-2xl font-semibold text-white">
                      {analytics.conversionRatePercent.toFixed(1)}%
                    </p>
                    <div className="mb-1 flex h-8 flex-1 items-end gap-0.5">
                      {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-blue-600/70"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Metrics unavailable.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
