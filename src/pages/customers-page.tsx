import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  deleteUser,
  downloadUsersExport,
  fetchUsersList,
  type UserListItem,
} from '../lib/api/users'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 10

type OrderChip = 'all' | 'gt0' | 'gt5' | 'gt10'

function orderChipToParam(chip: OrderChip): number | undefined {
  switch (chip) {
    case 'all':
      return undefined
    case 'gt0':
      return 0
    case 'gt5':
      return 5
    case 'gt10':
      return 10
    default:
      return undefined
  }
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatJoined(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'created_at', label: 'Joined date' },
  { value: 'name', label: 'Name' },
  { value: 'total_orders', label: 'Total orders' },
  { value: 'total_spent', label: 'Total spent' },
]

export function CustomersPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const filterRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<UserListItem[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: PER_PAGE,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [orderChip, setOrderChip] = useState<OrderChip>('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filterOpen, setFilterOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!filterOpen) return
      const el = filterRef.current
      if (el && !el.contains(e.target as Node)) setFilterOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [filterOpen])

  const loadPage = useCallback(async () => {
    if (!token) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const oc = orderChipToParam(orderChip)
      const { items: rows, pagination: pag } = await fetchUsersList(token, {
        search: searchDebounced || undefined,
        page,
        perPage: PER_PAGE,
        orderCountGt: oc,
        sortBy,
        sortDir,
      })
      setItems(rows)
      setPagination(pag)
    } catch (e) {
      showApiError(e)
      setItems([])
      setPagination((p) => ({ ...p, total: 0, totalPages: 0 }))
    } finally {
      setLoading(false)
    }
  }, [token, page, searchDebounced, orderChip, sortBy, sortDir, showApiError])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    setPage(1)
  }, [searchDebounced, orderChip, sortBy, sortDir])

  async function handleExport() {
    if (!token) {
      showToast('Sign in to export.', 'error')
      return
    }
    setExporting(true)
    try {
      await downloadUsersExport(token, {
        search: searchDebounced || undefined,
        orderCountGt: orderChipToParam(orderChip),
        sortBy,
        sortDir,
      })
      showToast('Export started.', 'success')
    } catch (e) {
      showApiError(e)
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete(row: UserListItem) {
    if (!token) return
    if (
      !window.confirm(
        `Delete user “${row.name}”? This cannot be undone.`,
      )
    ) {
      return
    }
    try {
      await deleteUser(token, row.id)
      showToast('User deleted.', 'success')
      void loadPage()
    } catch (e) {
      showApiError(e)
    }
  }

  const from = items.length ? (page - 1) * pagination.perPage + 1 : 0
  const to = (page - 1) * pagination.perPage + items.length
  const totalPages = pagination.totalPages || Math.max(1, Math.ceil(pagination.total / PER_PAGE) || 1)

  function pageWindow(): number[] {
    const tp = totalPages
    const p = page
    if (tp <= 7) return Array.from({ length: tp }, (_, i) => i + 1)
    const out: number[] = []
    if (p <= 3) {
      for (let i = 1; i <= 4; i++) out.push(i)
      out.push(-1)
      out.push(tp)
      return out
    }
    if (p >= tp - 2) {
      out.push(1)
      out.push(-1)
      for (let i = tp - 3; i <= tp; i++) out.push(i)
      return out
    }
    out.push(1)
    out.push(-1)
    for (let i = p - 1; i <= p + 1; i++) out.push(i)
    out.push(-1)
    out.push(tp)
    return out
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and view shop users and their performance.
          </p>
        </div>
        <button
          type="button"
          disabled={!token || exporting}
          onClick={() => void handleExport()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-[#0f1419] dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
            />
          </svg>
          {exporting ? 'Exporting…' : 'Export users'}
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
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
              placeholder="Search users by name or email…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none ring-blue-500/30 focus:border-blue-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900/80 dark:focus:border-blue-500"
            />
          </div>
          <div className="relative flex flex-wrap items-center gap-2" ref={filterRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setFilterOpen((o) => !o)
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                filterOpen
                  ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M8 12h8m-4 6h4" />
              </svg>
              Filter
            </button>
            {filterOpen ? (
              <div
                className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Sort</p>
                <label className="block text-xs text-slate-500 dark:text-slate-400" htmlFor="cust-sort-by">
                  Sort by
                </label>
                <select
                  id="cust-sort-by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="select-tail mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400" htmlFor="cust-sort-dir">
                  Direction
                </label>
                <select
                  id="cust-sort-dir"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                  className="select-tail mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          {(
            [
              { key: 'all' as const, label: 'All users' },
              { key: 'gt0' as const, label: 'Order Count > 0' },
              { key: 'gt5' as const, label: 'Order Count > 5' },
              { key: 'gt10' as const, label: 'Order Count > 10' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOrderChip(key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                orderChip === key
                  ? 'bg-blue-600 text-white shadow-sm dark:bg-blue-600'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {!token ? (
          <p className="border-b border-slate-100 px-4 py-2 text-xs text-amber-700 dark:border-slate-800 dark:text-amber-200/90">
            Sign in to load users.
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Total orders</th>
                <th className="px-4 py-3">Total spent</th>
                <th className="px-4 py-3">Joined date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Loading users…
                  </td>
                </tr>
              ) : !token ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Sign in to view users.
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No users match this view.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const img = row.avatarUrl ? resolveMediaUrl(row.avatarUrl) : ''
                  const active = row.status.toLowerCase() === 'active'
                  return (
                    <tr key={row.id} className="bg-white dark:bg-[#0f1419]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 text-xs font-semibold text-white dark:border-slate-700"
                            style={
                              img
                                ? undefined
                                : { backgroundColor: row.avatarColor || '#3B82F6' }
                            }
                          >
                            {img ? (
                              <img src={img} alt="" className="h-full w-full object-cover" />
                            ) : (
                              row.initials || row.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/users/${encodeURIComponent(row.id)}`}
                              className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                            >
                              {row.name}
                            </Link>
                            <p className="text-[10px] uppercase tracking-wide text-slate-400">
                              {active ? 'Active' : row.status || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {row.phone || '—'}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-700 dark:text-slate-300">
                        {row.email}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {formatInt(row.totalOrders)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-700 dark:text-slate-300">
                        {formatMoney(row.totalSpent)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {formatJoined(row.joinedDate)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-0.5">
                          <Link
                            to={`/users/${encodeURIComponent(row.id)}`}
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
                          <Link
                            to={`/users/${encodeURIComponent(row.id)}/edit`}
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
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => void handleDelete(row)}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
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

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row">
          <p className="text-center sm:text-left">
            Showing {from} to {to} of {formatInt(pagination.total)} results
          </p>
          <div className="flex flex-wrap items-center justify-center gap-1">
            <button
              type="button"
              disabled={page <= 1 || loading || !token}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Previous page"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {pageWindow().map((n, i) =>
              n === -1 ? (
                <span key={`e-${i}`} className="px-2 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  disabled={loading || !token}
                  onClick={() => setPage(n)}
                  className={`min-w-[2.25rem] rounded-lg px-2 py-1.5 text-xs font-medium tabular-nums transition ${
                    page === n
                      ? 'bg-blue-600 text-white dark:bg-blue-600'
                      : 'border border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={loading || !token || page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              aria-label="Next page"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
