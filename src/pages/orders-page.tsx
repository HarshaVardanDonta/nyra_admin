import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchOrderStatuses } from '../lib/api/order-statuses'
import {
  type OrderListRow,
  type OrdersListParams,
  downloadJsonFile,
  downloadOrdersExport,
  fetchOrderInvoiceJson,
  fetchOrders,
} from '../lib/api/orders'
import { fetchUsersList, userPublicIdToOrderListQuery } from '../lib/api/users'

const PER_PAGE = 10

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatOrderDate(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function indicatorBadgeClass(color: string): string {
  const c = color.trim().toLowerCase()
  const map: Record<string, string> = {
    yellow: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
    green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    emerald: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    gray: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    grey: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  }
  if (c.startsWith('#')) {
    return 'border-slate-500/30 bg-slate-500/10 text-slate-800 dark:text-slate-200'
  }
  return map[c] ?? 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
}

function paymentBadgeClass(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === 'paid') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  if (s === 'unpaid') return 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
  if (s === 'refunded' || s === 'partially_refunded')
    return 'bg-red-500/15 text-red-700 dark:text-red-300'
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-300'
}

const PERIOD_OPTIONS: { value: OrdersListParams['period']; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '7d', label: 'Last 7 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
]

const PAYMENT_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All payments' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'partially_refunded', label: 'Partially refunded' },
]

export function OrdersPage() {
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const navigate = useNavigate()

  const [rows, setRows] = useState<OrderListRow[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    perPage: PER_PAGE,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const [search, setSearch] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [statusId, setStatusId] = useState<string>('')
  const [period, setPeriod] = useState<OrdersListParams['period']>('30d')
  const [userFilterId, setUserFilterId] = useState<string>('')
  const [paymentStatus, setPaymentStatus] = useState('')

  const [statusOptions, setStatusOptions] = useState<{ id: number; name: string }[]>([])
  const [userOptions, setUserOptions] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350)
    return () => window.clearTimeout(t)
  }, [search])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchOrderStatuses(token)
        if (cancelled) return
        const sorted = [...list].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
        setStatusOptions(sorted.map((s) => ({ id: s.id, name: s.name })))
      } catch {
        if (!cancelled) setStatusOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { items } = await fetchUsersList(token, { page: 1, perPage: 100, sortBy: 'name', sortDir: 'asc' })
        if (cancelled) return
        setUserOptions(items.map((c) => ({ id: c.id, name: c.name || c.email })))
      } catch {
        if (!cancelled) setUserOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const listParams = useMemo((): OrdersListParams => {
    const sid = statusId ? Number.parseInt(statusId, 10) : undefined
    const uid =
      userFilterId.trim() ? userPublicIdToOrderListQuery(userFilterId.trim()) : undefined
    return {
      search: searchDebounced || undefined,
      page: pagination.page,
      per_page: pagination.perPage,
      status_id: sid && Number.isFinite(sid) && sid > 0 ? sid : undefined,
      user_id: uid,
      period: period ?? '30d',
      payment_status: paymentStatus || undefined,
      sort_by: 'date',
      sort_dir: 'desc',
    }
  }, [
    searchDebounced,
    pagination.page,
    pagination.perPage,
    statusId,
    userFilterId,
    period,
    paymentStatus,
  ])

  const exportParams = useMemo(
    () => ({
      search: listParams.search,
      status_id: listParams.status_id,
      user_id: listParams.user_id,
      period: listParams.period,
      payment_status: listParams.payment_status,
      sort_by: listParams.sort_by,
      sort_dir: listParams.sort_dir,
    }),
    [listParams],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchOrders(token, listParams)
      setRows(res.data)
      setPagination((p) => ({
        ...p,
        perPage: res.pagination.per_page,
        total: res.pagination.total,
        totalPages: res.pagination.total_pages,
      }))
    } catch (e) {
      showApiError(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token, listParams, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPagination((p) => ({ ...p, page: 1 }))
  }, [searchDebounced, statusId, userFilterId, period, paymentStatus])

  async function handleExport() {
    setExporting(true)
    try {
      await downloadOrdersExport(token, exportParams)
      showToast('Export started.', 'success')
    } catch (e) {
      showApiError(e)
    } finally {
      setExporting(false)
    }
  }

  async function handleInvoiceDownload(orderId: number, orderNumber: string) {
    try {
      const data = await fetchOrderInvoiceJson(token, orderId)
      const safe = orderNumber.replace(/[^\w-]+/g, '_') || String(orderId)
      downloadJsonFile(`invoice-${safe}.json`, data)
      showToast('Invoice data downloaded.', 'success')
    } catch (e) {
      showApiError(e)
    }
  }

  const pageWindow = useMemo(() => {
    const total = pagination.totalPages
    if (total < 1) return []
    const cur = Math.min(pagination.page, total)
    let start = Math.max(1, cur - 1)
    if (start + 2 > total) start = Math.max(1, total - 2)
    const pages: number[] = []
    for (let i = start; i <= Math.min(total, start + 2); i++) pages.push(i)
    return pages
  }, [pagination.page, pagination.totalPages])

  const fromIdx = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.perPage + 1
  const toIdx = Math.min(pagination.page * pagination.perPage, pagination.total)

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage and track your customer orders in real-time.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={() => void handleExport()}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
            />
          </svg>
          {exporting ? 'Exporting…' : 'Export'}
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111827] lg:flex-row lg:flex-wrap lg:items-center [&>select]:min-w-[12rem] [&>select]:max-w-full [&>select]:shrink-0">
        <div className="relative min-w-0 flex-1 lg:min-w-[200px]">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by order ID or user…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <select
          value={statusId}
          onChange={(e) => setStatusId(e.target.value)}
          className="select-tail w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 lg:w-auto"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={period ?? '30d'}
          onChange={(e) => setPeriod(e.target.value as OrdersListParams['period'])}
          className="select-tail w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 lg:w-auto"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value ?? ''}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={userFilterId}
          onChange={(e) => setUserFilterId(e.target.value)}
          className="select-tail w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 lg:w-auto"
        >
          <option value="">All users</option>
          {userOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className="select-tail w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 lg:w-auto"
        >
          {PAYMENT_FILTER_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                    No orders match your filters.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <Link
                        to={`/orders/${row.id}`}
                        className="font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        #{row.order_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {row.user ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: row.user.avatar_color }}
                          >
                            {row.user.initials || '?'}
                          </span>
                          <span className="font-medium text-slate-800 dark:text-slate-200">{row.user.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatInt(row.items_count)}</td>
                    <td className="px-4 py-3 tabular-nums font-medium">{formatMoney(row.grand_total)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${paymentBadgeClass(row.payment_status)}`}
                      >
                        {row.payment_status.replace(/_/g, ' ') || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${indicatorBadgeClass(row.status.indicator_color)}`}
                      >
                        {row.status.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatOrderDate(row.date)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${row.id}`)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                          title="View"
                          aria-label="View order"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(`/orders/${row.id}?edit=1`)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                          title="Edit notes"
                          aria-label="Edit order"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleInvoiceDownload(row.id, row.order_number)}
                          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                          title="Download invoice data (JSON)"
                          aria-label="Download invoice"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {fromIdx} to {toIdx} of {formatInt(pagination.total)} results
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={pagination.page <= 1 || loading}
              onClick={() => setPagination((p) => ({ ...p, page: Math.max(1, p.page - 1) }))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-600"
            >
              Previous
            </button>
            {pageWindow.map((pg) => (
              <button
                key={pg}
                type="button"
                disabled={loading}
                onClick={() => setPagination((p) => ({ ...p, page: pg }))}
                className={`min-w-[2rem] rounded-lg px-3 py-1.5 text-xs font-medium ${
                  pg === pagination.page
                    ? 'bg-blue-600 text-white'
                    : 'border border-slate-200 dark:border-slate-600'
                }`}
              >
                {pg}
              </button>
            ))}
            <button
              type="button"
              disabled={
                loading || pagination.totalPages <= 0 || pagination.page >= pagination.totalPages
              }
              onClick={() =>
                setPagination((p) => ({
                  ...p,
                  page: Math.min(p.totalPages, p.page + 1),
                }))
              }
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-600"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
