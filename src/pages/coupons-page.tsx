import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  couponDisplayStatus,
  couponTabBucket,
  deleteCoupon,
  fetchCouponsList,
  type CouponRecord,
  type CouponTabBucket,
} from '../lib/api/coupons'

const FETCH_LIMIT = 200
const PER_PAGE = 8

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatDateLong(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function statusBadgeClass(status: ReturnType<typeof couponDisplayStatus>) {
  switch (status) {
    case 'active':
      return 'border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'scheduled':
      return 'border border-blue-500/35 bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'expired':
      return 'border border-slate-500/35 bg-slate-500/15 text-slate-600 dark:text-slate-400'
    default:
      return 'border border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-200'
  }
}

function statusLabel(status: ReturnType<typeof couponDisplayStatus>) {
  switch (status) {
    case 'active':
      return 'ACTIVE'
    case 'scheduled':
      return 'SCHEDULED'
    case 'expired':
      return 'EXPIRED'
    default:
      return 'INACTIVE'
  }
}

function discountCell(c: CouponRecord) {
  if (c.discountType === 'fixed') {
    return (
      <span className="font-medium text-emerald-600 dark:text-emerald-400">
        {formatMoney(c.discountValue)} flat
      </span>
    )
  }
  return <span>{c.discountValue}% off</span>
}

export function CouponsPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [rawItems, setRawItems] = useState<CouponRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<CouponTabBucket | 'all'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items } = await fetchCouponsList(token, { limit: FETCH_LIMIT, offset: 0 })
      setRawItems(items)
    } catch (e) {
      showApiError(e)
      setRawItems([])
    } finally {
      setLoading(false)
    }
  }, [token, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toUpperCase()
    return rawItems.filter((c) => {
      if (tab !== 'all' && couponTabBucket(c) !== tab) return false
      if (q && !c.code.toUpperCase().includes(q)) return false
      return true
    })
  }, [rawItems, tab, search])

  useEffect(() => {
    setPage(1)
  }, [tab, search])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const sliceStart = (safePage - 1) * PER_PAGE
  const items = filtered.slice(sliceStart, sliceStart + PER_PAGE)

  const pageInfo = useMemo(() => {
    const from = total === 0 ? 0 : sliceStart + 1
    const to = sliceStart + items.length
    return { from, to }
  }, [total, sliceStart, items.length])

  async function handleDeleteRow(id: string, code: string) {
    if (!token) {
      showToast('Sign in to delete coupons.', 'error')
      return
    }
    if (!window.confirm(`Delete coupon “${code}”? This cannot be undone.`)) return
    try {
      await deleteCoupon(token, id)
      showToast('Coupon deleted.', 'success')
      void load()
    } catch (e) {
      showApiError(e)
    }
  }

  const tabs: { id: CouponTabBucket | 'all'; label: string }[] = [
    { id: 'all', label: 'All coupons' },
    { id: 'active', label: 'Active' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'expired', label: 'Expired' },
    { id: 'inactive', label: 'Inactive' },
  ]

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage discounts and promotional codes for your store.
          </p>
        </div>
        <Link
          to="/coupons/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create coupon
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900/80">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-0 w-full flex-1 sm:max-w-sm">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by coupon code…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3">Coupon code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min. order</th>
                <th className="px-4 py-3">Usage limit</th>
                <th className="px-4 py-3">Expiration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No coupons in this view.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const st = couponDisplayStatus(row)
                  const limit = row.totalUsageLimit
                  const pct =
                    limit != null && limit > 0 ? Math.min(100, (row.timesUsed / limit) * 100) : 0
                  return (
                    <tr key={row.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3">
                        <span className="inline-block rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
                          {row.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">{discountCell(row)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        {row.minimumOrderValue > 0 ? formatMoney(row.minimumOrderValue) : '—'}
                      </td>
                      <td className="min-w-[140px] px-4 py-3">
                        {limit != null ? (
                          <div>
                            <p className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                              {row.timesUsed} / {limit}
                            </p>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                              <div
                                className="h-full rounded-full bg-blue-600 dark:bg-blue-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">Unlimited</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDateLong(row.expirationDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${statusBadgeClass(st)}`}
                        >
                          {statusLabel(st)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/coupons/${encodeURIComponent(row.id)}`}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                            aria-label="View"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                              />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Link>
                          <Link
                            to={`/coupons/${encodeURIComponent(row.id)}/edit`}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                            aria-label="Edit"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
                              />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRow(row.id, row.code)}
                            className="rounded-lg p-2 text-red-600/80 transition hover:bg-red-500/10"
                            aria-label="Delete"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
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

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {pageInfo.from} to {pageInfo.to} of {formatInt(total)} coupon{total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:enabled:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:enabled:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
