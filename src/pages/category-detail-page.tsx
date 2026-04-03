import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { deleteCategory, fetchCategoryDetail, fetchChildCategories, type CategoryRecord } from '../lib/api/categories'
import { fetchCatalogCategories, fetchProductsList, type CatalogCategory } from '../lib/api/catalog'
import { resolveMediaUrl } from '../lib/media-url'

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatInrFromCents(cents: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100)
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function CategoryDetailPage() {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [category, setCategory] = useState<CategoryRecord | null>(null)
  const [children, setChildren] = useState<CategoryRecord[]>([])
  const [allCats, setAllCats] = useState<CatalogCategory[]>([])
  const [productTotal, setProductTotal] = useState(0)
  const [revenueSampleCents, setRevenueSampleCents] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!categoryId) return
    setLoading(true)
    try {
      const [cat, subs, plist, catalogCats] = await Promise.all([
        fetchCategoryDetail(token, categoryId),
        fetchChildCategories(categoryId).catch(() => [] as CategoryRecord[]),
        fetchProductsList(token, {
          limit: 100,
          offset: 0,
          categoryId,
          publication: 'all',
        }),
        fetchCatalogCategories().catch(() => [] as CatalogCategory[]),
      ])
      setCategory(cat)
      setChildren(subs)
      setAllCats(catalogCats)
      setProductTotal(plist.total)
      let rev = 0
      for (const p of plist.items) {
        const price = p.basePrice ?? 0
        const q = p.stockQuantity ?? 0
        if (price > 0 && q > 0) rev += price * q
      }
      setRevenueSampleCents(plist.items.length ? rev : null)
    } catch (e) {
      showApiError(e)
      setCategory(null)
      setChildren([])
      setProductTotal(0)
      setRevenueSampleCents(null)
    } finally {
      setLoading(false)
    }
  }, [categoryId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  const parentName = useMemo(() => {
    if (!category?.parentCategoryId) return 'Root'
    const hit = allCats.find((c) => c.id === category.parentCategoryId)
    return hit?.name ?? category.parentName ?? category.parentCategoryId
  }, [category, allCats])

  const seoHint = useMemo(() => {
    const slugOk = Boolean(category?.slug && category.slug.length >= 2)
    const descOk = Boolean(category?.description && category.description.trim().length > 40)
    return slugOk && descOk
  }, [category])

  async function handleDelete() {
    if (!token || !categoryId) {
      showToast('Sign in to delete categories.', 'error')
      return
    }
    if (!window.confirm('Delete this category? Products may need to be reassigned first.')) return
    setDeleting(true)
    try {
      const ok = await deleteCategory(token, categoryId)
      if (ok) {
        showToast('Category deleted.', 'success')
        navigate('/categories')
      } else {
        showToast('Delete is not supported by the API.', 'error')
      }
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !category) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Category not found.'}
      </div>
    )
  }

  const active = category.isActive !== false
  const thumb = category.thumbnailUrl ? resolveMediaUrl(category.thumbnailUrl) : ''
  const banner = category.bannerUrl ? resolveMediaUrl(category.bannerUrl) : ''

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <nav className="mb-6 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link to="/categories" className="hover:text-blue-600 dark:hover:text-blue-400">
          Categories
        </Link>
        <span className="mx-2">/</span>
        <span className="font-medium text-blue-600 dark:text-blue-400">{category.name}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
          {category.description ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{category.description}</p>
          ) : (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-500">No description yet.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/categories/${encodeURIComponent(category.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit Category
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-950/60 disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          {banner ? (
            <div className="h-36 w-full bg-slate-900">
              <img src={banner} alt="" className="h-full w-full object-cover opacity-90" />
            </div>
          ) : null}
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-teal-600/20 dark:border-slate-700">
              {thumb ? (
                <img src={thumb} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-teal-700 dark:text-teal-300">
                  {category.name.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">Slug</p>
              <p className="mt-0.5 font-mono text-slate-800 dark:text-slate-200">{category.slug ?? '—'}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Parent category
              </p>
              <p className="mt-0.5 text-slate-700 dark:text-slate-300">{parentName}</p>
              {category.description ? (
                <>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Description
                  </p>
                  <p className="mt-1 text-slate-600 dark:text-slate-400">{category.description}</p>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Category status</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className={
                active
                  ? 'rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
                  : 'rounded-full border border-slate-500/40 bg-slate-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500'
              }
            >
              {active ? 'Public' : 'Hidden'}
            </span>
            <span
              className={
                seoHint
                  ? 'rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300'
                  : 'rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200'
              }
            >
              {seoHint ? 'Optimized' : 'Needs work'}
            </span>
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Last updated: <span className="text-slate-700 dark:text-slate-300">{formatDate(category.updatedAt)}</span>
          </p>
        </section>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_320px]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total products</p>
            <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatInt(productTotal)}</p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">From admin / catalog product index</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Inventory value (sample)</p>
            <span className="rounded-lg bg-violet-500/10 p-2 text-violet-600 dark:text-violet-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {revenueSampleCents != null ? formatInrFromCents(revenueSampleCents) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">basePrice × stock on first 100 rows</p>
        </div>
        <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-5 dark:bg-blue-500/10 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Pro tip</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            Categories with distinctive thumbnails tend to perform better in navigation. Upload a clear banner for this
            aisle when you have campaign art ready.
          </p>
          <Link
            to={`/categories/${encodeURIComponent(category.id)}/edit`}
            className="mt-4 inline-flex rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
          >
            Update image
          </Link>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Subcategories</h2>
          <Link
            to={`/categories/new?parent=${encodeURIComponent(category.id)}`}
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Add new
          </Link>
        </div>
        {children.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            No subcategories yet.{' '}
            <Link to={`/categories/new?parent=${encodeURIComponent(category.id)}`} className="text-blue-600 dark:text-blue-400">
              Create one
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {children.map((sub) => {
              const st = sub.thumbnailUrl ? resolveMediaUrl(sub.thumbnailUrl) : ''
              const pc = sub.productCount
              return (
                <li key={sub.id}>
                  <Link
                    to={`/categories/${encodeURIComponent(sub.id)}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/80"
                  >
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                      {st ? (
                        <img src={st} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">{sub.name.slice(0, 1)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">{sub.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {pc != null ? `${formatInt(pc)} products` : 'Products —'}
                      </p>
                    </div>
                    <svg
                      className="h-5 w-5 shrink-0 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.75}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
