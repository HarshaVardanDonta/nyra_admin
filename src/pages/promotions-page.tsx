import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  deletePromotion,
  fetchPromotionStats,
  fetchPromotionsList,
  promotionDisplayStatus,
  type PromotionRecord,
  type PromotionStats,
  type PromotionTabBucket,
} from '../lib/api/promotions'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 8

function formatDateRange(start?: string, end?: string) {
  const fmt = (iso: string | undefined) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  }
  if (!start && !end) return '—'
  return `${fmt(start)} — ${fmt(end)}`
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function targetTypeLabel(t: string | undefined) {
  if (!t) return '—'
  return t.toUpperCase()
}

function statusBadgeClass(status: ReturnType<typeof promotionDisplayStatus>) {
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

function statusLabel(status: ReturnType<typeof promotionDisplayStatus>) {
  switch (status) {
    case 'active':
      return 'Active'
    case 'scheduled':
      return 'Scheduled'
    case 'expired':
      return 'Expired'
    default:
      return 'Inactive'
  }
}

export function PromotionsPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [items, setItems] = useState<PromotionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<PromotionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [tab, setTab] = useState<PromotionTabBucket>('all')

  const loadStats = useCallback(async () => {
    try {
      const s = await fetchPromotionStats(token)
      setStats(s)
    } catch {
      setStats(null)
    }
  }, [token])

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: serverTotal } = await fetchPromotionsList(token, {
        limit: PER_PAGE,
        offset,
        bucket: tab,
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
  }, [token, page, tab, showApiError])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    setPage(1)
  }, [tab])

  const pageInfo = useMemo(() => {
    const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
    const to = Math.min(page * PER_PAGE, total)
    return { from, to }
  }, [page, total])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  async function handleDeleteRow(id: string, title: string) {
    if (!token) {
      showToast('Sign in to delete promotions.', 'error')
      return
    }
    if (!window.confirm(`Delete promotion “${title}”? This cannot be undone.`)) return
    try {
      await deletePromotion(token, id)
      showToast('Promotion deleted.', 'success')
      void loadPage()
      void loadStats()
    } catch (e) {
      showApiError(e)
    }
  }

  const tabs: { id: PromotionTabBucket; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'expired', label: 'Expired' },
  ]

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Promotions</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Manage banner displays and seasonal marketing campaigns.
          </p>
        </div>
        <Link
          to="/promotions/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Promotion
        </Link>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Active promotions</p>
            <span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.86 2.55m.022-5.975a14.922 14.922 0 00-1.019 3.025c0 1.035.21 2.02.59 2.91"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatInt(stats?.activeLive ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Live on storefront window</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total campaigns</p>
            <span className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatInt(stats?.total ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">All promotions in the system</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Scheduled</p>
            <span className="rounded-lg bg-violet-500/10 p-2 text-violet-600 dark:text-violet-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
            </span>
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums">{formatInt(stats?.scheduled ?? 0)}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">CTR / clicks not tracked yet</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
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
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3">Banner</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Redirect</th>
                <th className="px-4 py-3">Schedule</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No promotions in this view.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const st = promotionDisplayStatus(row)
                  const bannerSrc = row.bannerImageUrl ? resolveMediaUrl(row.bannerImageUrl) : ''
                  return (
                    <tr key={row.id} className="text-slate-800 dark:text-slate-200">
                      <td className="px-4 py-3">
                        <div className="h-12 w-20 overflow-hidden rounded-md border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                          {bannerSrc ? (
                            <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center text-[10px] text-slate-400">No image</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900 dark:text-slate-50">{row.title || '—'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Priority #{row.priorityOrder}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {row.targetType ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900/60">
                            <span className="text-slate-500 dark:text-slate-400">{targetTypeLabel(row.targetType)}</span>
                            <span className="text-slate-900 dark:text-slate-100">{row.targetLabel || '—'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                        {formatDateRange(row.startDate, row.expirationDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(st)}`}
                        >
                          {statusLabel(st)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/promotions/${encodeURIComponent(row.id)}`}
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                            aria-label="View"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </Link>
                          <Link
                            to={`/promotions/${encodeURIComponent(row.id)}/edit`}
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
                            onClick={() => void handleDeleteRow(row.id, row.title)}
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
            Showing {pageInfo.from} to {pageInfo.to} of {formatInt(total)} results
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium transition enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:enabled:hover:bg-slate-800"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
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
