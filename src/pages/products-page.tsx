import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  type CatalogCategory,
  type CatalogProductRow,
  categoryBreadcrumb,
  fetchCatalogCategories,
  fetchCatalogBrands,
  fetchProductsList,
  type CatalogBrand,
  type PublicationListFilter,
} from '../lib/api/catalog'
import { formatInr, patchProductFromCatalog } from '../lib/api/products'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 10

type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
type DiscountFilter = 'all' | 'active' | 'inactive'

function isUnpublishedProduct(row: CatalogProductRow) {
  return row.status?.isPublished === false
}

function discountPercent(base: number, discount: number) {
  if (base <= 0 || discount >= base) return 0
  return Math.round((1 - discount / base) * 100)
}

function stockStatus(row: CatalogProductRow): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (row.isOutOfStock) return 'out_of_stock'
  const q = row.stockQuantity ?? 0
  if (q <= 0) return 'out_of_stock'
  if (q < 15) return 'low_stock'
  return 'in_stock'
}

function stockBadgeClass(s: ReturnType<typeof stockStatus>) {
  switch (s) {
    case 'in_stock':
      return 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'low_stock':
      return 'border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
    case 'out_of_stock':
      return 'border border-red-500/40 bg-red-950/40 text-red-300'
    default:
      return 'border border-slate-500/35 bg-slate-500/15 text-slate-600 dark:text-slate-300'
  }
}

function stockLabel(s: ReturnType<typeof stockStatus>) {
  switch (s) {
    case 'in_stock':
      return 'IN STOCK'
    case 'low_stock':
      return 'LOW STOCK'
    case 'out_of_stock':
      return 'OUT OF STOCK'
    default:
      return '—'
  }
}

function downloadCsv(filename: string, rows: Record<string, string>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h] ?? '')).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function ProductsPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  /** Full current result set (one server page, or up to 100 rows when stock/discount filters apply). */
  const [fullRows, setFullRows] = useState<CatalogProductRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [discountFilter, setDiscountFilter] = useState<DiscountFilter>('all')
  const [publicationFilter, setPublicationFilter] = useState<PublicationListFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    const b = searchParams.get('brandId')
    if (b) setBrandId(b)
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [b, c] = await Promise.all([fetchCatalogBrands(), fetchCatalogCategories()])
        if (!cancelled) {
          setBrands(b)
          setCategories(c)
        }
      } catch (e) {
        if (!cancelled) showApiError(e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [showApiError])

  const clientFilterActive = stockFilter !== 'all' || discountFilter !== 'all'

  const loadServerPage = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rawItems, total: serverTotal } = await fetchProductsList(token, {
        limit: PER_PAGE,
        offset,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        search: searchDebounced || undefined,
        publication: publicationFilter,
      })
      setFullRows(rawItems)
      setTotal(serverTotal)
    } catch (e) {
      showApiError(e)
      setFullRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [token, categoryId, brandId, searchDebounced, publicationFilter, page, showApiError])

  const loadClientFiltered = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    try {
      const { items: rawItems } = await fetchProductsList(token, {
        limit: 100,
        offset: 0,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        search: searchDebounced || undefined,
        publication: publicationFilter,
      })
      let filtered = rawItems
      if (publicationFilter === 'published') {
        filtered = filtered.filter((r) => !isUnpublishedProduct(r))
      } else if (publicationFilter === 'unpublished') {
        filtered = filtered.filter((r) => isUnpublishedProduct(r))
      }
      if (stockFilter !== 'all') {
        filtered = filtered.filter((r) => stockStatus(r) === stockFilter)
      }
      if (discountFilter === 'active') {
        filtered = filtered.filter(
          (r) =>
            r.hasSpecialDiscount &&
            r.discountPrice != null &&
            r.basePrice != null &&
            r.discountPrice < r.basePrice,
        )
      }
      if (discountFilter === 'inactive') {
        filtered = filtered.filter(
          (r) =>
            !r.hasSpecialDiscount ||
            r.discountPrice == null ||
            r.basePrice == null ||
            r.discountPrice >= r.basePrice,
        )
      }
      setFullRows(filtered)
      setTotal(filtered.length)
    } catch (e) {
      showApiError(e)
      setFullRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [
    token,
    categoryId,
    brandId,
    searchDebounced,
    stockFilter,
    discountFilter,
    publicationFilter,
    showApiError,
  ])

  useEffect(() => {
    if (clientFilterActive) void loadClientFiltered()
    else void loadServerPage()
  }, [clientFilterActive, loadClientFiltered, loadServerPage])

  useEffect(() => {
    setPage(1)
  }, [categoryId, brandId, searchDebounced, stockFilter, discountFilter, publicationFilter])

  const items = useMemo(() => {
    if (clientFilterActive) {
      const start = (page - 1) * PER_PAGE
      return fullRows.slice(start, start + PER_PAGE)
    }
    return fullRows
  }, [clientFilterActive, fullRows, page])

  const reload = useCallback(async () => {
    if (clientFilterActive) await loadClientFiltered()
    else await loadServerPage()
  }, [clientFilterActive, loadClientFiltered, loadServerPage])

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE))
  const displayFrom = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
  const displayTo = Math.min(page * PER_PAGE, total)

  const visibleIds = useMemo(() => items.map((r) => r.id), [items])
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someVisibleSelected = visibleIds.some((id) => selected.has(id))

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected
  }, [someVisibleSelected, allVisibleSelected])

  function toggleSelectAll(checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) {
        for (const id of visibleIds) next.add(id)
      } else {
        for (const id of visibleIds) next.delete(id)
      }
      return next
    })
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function runBulk(
    label: string,
    fn: (id: string) => Promise<unknown>,
  ) {
    if (!token) {
      showToast('Sign in again to continue.', 'error')
      return
    }
    const ids = [...selected]
    if (!ids.length) {
      showToast('Select at least one product.', 'error')
      return
    }
    setBulkWorking(true)
    try {
      for (const id of ids) {
        await fn(id)
      }
      showToast(label, 'success')
      await reload()
    } catch (e) {
      showApiError(e)
    } finally {
      setBulkWorking(false)
    }
  }

  function exportCsv() {
    const rows = items.map((r) => ({
      name: r.name,
      sku: r.sku ?? '',
      brand: r.brand?.name ?? '',
      category: categoryBreadcrumb(categories, r.category?.id ?? r.categoryId),
      price_inr: String(r.basePrice ?? ''),
      stock: String(r.stockQuantity ?? ''),
    }))
    downloadCsv(`products-page-${page}.csv`, rows)
  }

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage your inventory and stock levels
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
            </svg>
            Export CSV
          </button>
          <Link
            to="/products/new"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add New Product
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, SKU, or brand…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Stock Status</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
            <select
              value={discountFilter}
              onChange={(e) => setDiscountFilter(e.target.value as DiscountFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Discount Active</option>
              <option value="active">Yes</option>
              <option value="inactive">No</option>
            </select>
            <select
              value={publicationFilter}
              onChange={(e) => setPublicationFilter(e.target.value as PublicationListFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
              title={token ? undefined : 'Admin API required for draft / unpublished rows'}
            >
              <option value="all">Publication: All</option>
              <option value="published">Published only</option>
              <option value="unpublished">Unpublished only</option>
            </select>
          </div>
        </div>
        {!token ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-200/90">
            Sign in to load products from the admin API; the public catalog only lists published items.
          </p>
        ) : null}
        {clientFilterActive ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            Stock and discount filters load up to 100 products at a time. Narrow category, brand, or search for
            best results.
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Bulk actions
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkWorking}
              onClick={() =>
                runBulk('Removed selected from storefront', (id) =>
                  patchProductFromCatalog(token!, id, { status: { isPublished: false } }),
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Delete Selected
            </button>
            <button
              type="button"
              disabled={bulkWorking}
              onClick={() =>
                runBulk('Discount enabled', (id) =>
                  patchProductFromCatalog(token!, id, { hasSpecialDiscount: true }),
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Enable Discount
            </button>
            <button
              type="button"
              disabled={bulkWorking}
              onClick={() =>
                runBulk('Products marked unavailable', (id) =>
                  patchProductFromCatalog(token!, id, { isOutOfStock: true }),
                )
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Disable Products
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                <th className="w-10 px-4 py-3">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600"
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Brand / Category</th>
                <th className="px-4 py-3">Pricing</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400">
                    Loading products…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-500 dark:text-slate-400">
                    No products match your filters.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const thumb = row.thumbnailUrl ? resolveMediaUrl(row.thumbnailUrl) : ''
                  const st = stockStatus(row)
                  const base = row.basePrice ?? 0
                  const disc = row.discountPrice ?? null
                  const pct =
                    row.hasSpecialDiscount && disc != null && base > 0 && disc < base
                      ? discountPercent(base, disc)
                      : null
                  const qty = row.stockQuantity ?? 0
                  const barPct = Math.min(100, qty <= 0 ? 0 : Math.min(100, (qty / 200) * 100))

                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 transition hover:bg-slate-50/80 dark:border-slate-800/80 dark:hover:bg-slate-900/40"
                    >
                      <td className="px-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={(e) => toggleRow(row.id, e.target.checked)}
                          className="rounded border-slate-300 dark:border-slate-600"
                          aria-label={`Select ${row.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                            {thumb ? (
                              <img src={thumb} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">
                                —
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                              {row.name}
                            </p>
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                              SKU: {row.sku ?? '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-600 dark:text-slate-300">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {row.brand?.name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {categoryBreadcrumb(categories, row.category?.id ?? row.categoryId)}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <p className="font-medium tabular-nums">{formatInr(row.basePrice)}</p>
                        {pct != null ? (
                          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            {pct}% Off Active
                          </p>
                        ) : (
                          <p className="text-xs text-slate-500 dark:text-slate-500">No discount</p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <p className="tabular-nums text-slate-800 dark:text-slate-200">
                          {qty} units
                        </p>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className={
                              st === 'out_of_stock'
                                ? 'h-full rounded-full bg-red-500/80'
                                : st === 'low_stock'
                                  ? 'h-full rounded-full bg-amber-500'
                                  : 'h-full rounded-full bg-emerald-500'
                            }
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-col gap-1.5">
                          {isUnpublishedProduct(row) ? (
                            <span className="inline-flex w-fit rounded-full border border-slate-500/40 bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                              Draft
                            </span>
                          ) : (
                            <span className="inline-flex w-fit rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              Live
                            </span>
                          )}
                          <span
                            className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${stockBadgeClass(st)}`}
                          >
                            {stockLabel(st)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-right">
                        <div className="inline-flex justify-end gap-1">
                          <button
                            type="button"
                            title="View / Edit"
                            onClick={() => navigate(`/products/${encodeURIComponent(row.id)}/edit`)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => navigate(`/products/${encodeURIComponent(row.id)}/edit`)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15H9v-2.828z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Duplicate"
                            onClick={() =>
                              navigate('/products/new', { state: { duplicateFromId: row.id } })
                            }
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            title="Unpublish"
                            onClick={async () => {
                              if (!token) {
                                showToast('Sign in again to continue.', 'error')
                                return
                              }
                              if (!window.confirm(`Unpublish “${row.name}” from the storefront?`)) return
                              try {
                                await patchProductFromCatalog(token, row.id, {
                                  status: { isPublished: false },
                                })
                                showToast('Product unpublished', 'success')
                                await reload()
                              } catch (e) {
                                showApiError(e)
                              }
                            }}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h10" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {displayFrom} to {displayTo} of {total} results
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
            >
              Prev
            </button>
            {Array.from({ length: Math.min(pageCount, 8) }, (_, i) => {
              let n = i + 1
              if (pageCount > 8 && page > 4) n = page - 4 + i
              if (n < 1 || n > pageCount) return null
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={
                    n === page
                      ? 'rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white'
                      : 'rounded-lg border border-transparent px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-200 dark:text-slate-300 dark:hover:border-slate-700'
                  }
                >
                  {n}
                </button>
              )
            })}
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
