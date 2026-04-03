import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchCategoriesList, type CategoryRecord } from '../lib/api/categories'
import { fetchCatalogCategories, type CatalogCategory } from '../lib/api/catalog'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 10

function formatInt(n: number | undefined | null) {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

type StatusFilter = 'all' | 'active' | 'inactive'

export function CategoriesPage() {
  const { token } = useAuth()
  const { showApiError } = useToast()

  const [items, setItems] = useState<CategoryRecord[]>([])
  const [total, setTotal] = useState(0)
  const [parentOptions, setParentOptions] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [parentScope, setParentScope] = useState<string>('')

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cats = await fetchCatalogCategories()
        if (!cancelled) setParentOptions(cats)
      } catch {
        if (!cancelled) setParentOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const parentScopeParam = useMemo(() => {
    if (parentScope === '') return undefined
    if (parentScope === '__root__') return 'root'
    return parentScope
  }, [parentScope])

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: serverTotal } = await fetchCategoriesList(token, {
        limit: PER_PAGE,
        offset,
        search: searchDebounced || undefined,
        status: statusFilter,
        parentScope: parentScopeParam,
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
  }, [token, page, searchDebounced, statusFilter, parentScopeParam, showApiError])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, statusFilter, parentScope])

  const parentLabel = useCallback(
    (row: CategoryRecord) => {
      if (row.parentName) return row.parentName
      const pid = row.parentCategoryId
      if (!pid) return '—'
      const hit = parentOptions.find((c) => c.id === pid)
      return hit?.name ?? pid
    },
    [parentOptions],
  )

  return (
    <div className="p-6 pb-28 text-slate-900 dark:text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and organize your store&apos;s product hierarchy.
          </p>
        </div>
        <Link
          to="/categories/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Category
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.75}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search categories…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Filter by
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Status: All</option>
              <option value="active">Active</option>
              <option value="inactive">Hidden</option>
            </select>
            <select
              value={parentScope}
              onChange={(e) => setParentScope(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Parent: All</option>
              <option value="__root__">Top level</option>
              {parentOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  Under: {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setParentScope('')
              }}
              className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Clear filters
            </button>
          </div>
        </div>

        {!token ? (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-200/90">
            Sign in for the admin categories index when available; otherwise the table uses the public catalog.
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Parent</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Loading categories…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No categories match this view.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const active = row.isActive !== false
                  const thumb = row.thumbnailUrl ? resolveMediaUrl(row.thumbnailUrl) : ''
                  return (
                    <tr key={row.id} className="bg-white dark:bg-[#0f1419]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                            {thumb ? (
                              <img src={thumb} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-xs font-semibold text-slate-400">
                                {row.name.slice(0, 2).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/categories/${encodeURIComponent(row.id)}`}
                              className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                            >
                              {row.name}
                            </Link>
                            {row.slug ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">Slug: {row.slug}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{parentLabel(row)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-blue-700 dark:text-blue-300">
                          {formatInt(row.productCount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-400'}`}
                            aria-hidden
                          />
                          <span
                            className={
                              active
                                ? 'text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300'
                                : 'text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
                            }
                          >
                            {active ? 'Active' : 'Hidden'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/categories/${encodeURIComponent(row.id)}/edit`}
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
                            to={`/categories/${encodeURIComponent(row.id)}`}
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
            Showing {items.length ? (page - 1) * PER_PAGE + 1 : 0}–{(page - 1) * PER_PAGE + items.length} of{' '}
            {total} categories
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
