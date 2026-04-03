import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchBrandsList, type BrandRecord } from '../lib/api/brands'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 10

function formatInrFromCents(cents: number | undefined | null) {
  if (cents === undefined || cents === null || !Number.isFinite(cents)) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100)
}

function formatInt(n: number | undefined | null) {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

type StatusFilter = 'all' | 'active' | 'inactive'

export function BrandsPage() {
  const { token } = useAuth()
  const { showApiError } = useToast()

  const [items, setItems] = useState<BrandRecord[]>([])
  const [total, setTotal] = useState(0)
  const [statsItems, setStatsItems] = useState<BrandRecord[]>([])
  const [statsTotal, setStatsTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: serverTotal } = await fetchBrandsList(token, {
        limit: PER_PAGE,
        offset,
        search: searchDebounced || undefined,
        status: statusFilter,
      })
      setItems(rows)
      setTotal(serverTotal)
    } catch (e) {
      showApiError(e)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [token, page, searchDebounced, statusFilter, showApiError])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { items: allForStats, total: t } = await fetchBrandsList(token, {
          limit: 200,
          offset: 0,
          search: undefined,
          status: 'all',
        })
        if (!cancelled) {
          setStatsItems(allForStats)
          setStatsTotal(t)
        }
      } catch {
        if (!cancelled) {
          setStatsItems([])
          setStatsTotal(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, statusFilter])

  const stats = useMemo(() => {
    const list = statsItems.length ? statsItems : items
    const totalBrands = statsTotal ?? total
    const active = list.filter((b) => b.isActive !== false).length
    const inactive = list.filter((b) => b.isActive === false).length
    let top: BrandRecord | undefined
    let topSales = -1
    for (const b of list) {
      const pc = b.productCount
      if (pc != null && pc > topSales) {
        topSales = pc
        top = b
      }
    }
    let revenueSum = 0
    let revenueCount = 0
    for (const b of list) {
      const c = b.totalSalesCents
      if (c != null && Number.isFinite(c)) {
        revenueSum += c
        revenueCount += 1
      }
    }
    return {
      totalBrands,
      active,
      inactive,
      topName: top?.name ?? (list.length ? list[0]?.name : undefined),
      revenueDisplay:
        revenueCount > 0 ? formatInrFromCents(revenueSum) : '—',
    }
  }, [statsItems, items, total, statsTotal])

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Brand Management</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and monitor all your partner brands.
          </p>
        </div>
        <Link
          to="/brands/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Brand
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total brands</p>
            <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatInt(stats.totalBrands)}</p>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">Loaded index · see table for paging</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active brands</p>
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatInt(stats.active)}</p>
          {stats.inactive > 0 ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formatInt(stats.inactive)} inactive in sample
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">In current index</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Top by products</p>
            <span className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 truncate text-lg font-semibold">{stats.topName ?? '—'}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">When API exposes product counts</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total sales (index)</p>
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
          <p className="mt-3 text-2xl font-semibold tabular-nums">{stats.revenueDisplay}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sum of totalSales when present</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
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
              placeholder="Search brands, products…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-blue-500"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Filter: All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {!token ? (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-200/90">
            Sign in to use the admin brands index when available; the table may use the public catalog (active brands
            only).
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total sales</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Loading brands…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No brands match this view.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const active = row.isActive !== false
                  const logo = row.logoUrl ? resolveMediaUrl(row.logoUrl) : ''
                  return (
                    <tr key={row.id} className="bg-white dark:bg-[#0f1419]">
                      <td className="px-4 py-3">
                        <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                          {logo ? (
                            <img src={logo} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">
                              {row.name.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/brands/${encodeURIComponent(row.id)}`}
                          className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {row.name}
                        </Link>
                        {row.categoryLabel ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{row.categoryLabel}</p>
                        ) : row.slug ? (
                          <p className="text-xs text-slate-500 dark:text-slate-400">{row.slug}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {formatInt(row.productCount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            active
                              ? 'inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
                              : 'inline-flex rounded-full border border-red-500/40 bg-red-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300'
                          }
                        >
                          {active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {formatInrFromCents(row.totalSalesCents)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/brands/${encodeURIComponent(row.id)}/edit`}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                            title="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </Link>
                          <Link
                            to={`/brands/${encodeURIComponent(row.id)}`}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            title="View"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row">
          <p>
            Showing {items.length ? (page - 1) * PER_PAGE + 1 : 0}–
            {(page - 1) * PER_PAGE + items.length} of {total} brands
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="text-xs tabular-nums">
              Page {page} / {Math.max(1, Math.ceil(total / PER_PAGE) || 1)}
            </span>
            <button
              type="button"
              disabled={loading || page * PER_PAGE >= total}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
