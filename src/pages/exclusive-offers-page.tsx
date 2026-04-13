import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  deleteExclusiveOffer,
  exclusiveOfferStatus,
  fetchExclusiveOfferFilterCategories,
  fetchExclusiveOffersList,
  filterCategoryLabel,
  type ExclusiveOfferFilterCategory,
  type ExclusiveOfferRecord,
} from '../lib/api/exclusive-offers'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 8

function statusBadgeClass(status: ReturnType<typeof exclusiveOfferStatus>) {
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

function statusLabel(status: ReturnType<typeof exclusiveOfferStatus>) {
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

export function ExclusiveOffersPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [items, setItems] = useState<ExclusiveOfferRecord[]>([])
  const [filterCategories, setFilterCategories] = useState<ExclusiveOfferFilterCategory[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cats = await fetchExclusiveOfferFilterCategories(token)
        if (!cancelled) setFilterCategories(cats)
      } catch {
        if (!cancelled) setFilterCategories([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: serverTotal } = await fetchExclusiveOffersList(token, {
        limit: PER_PAGE,
        offset,
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
  }, [token, page, showApiError])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const pageInfo = useMemo(() => {
    const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
    const to = Math.min(page * PER_PAGE, total)
    return { from, to }
  }, [page, total])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  async function handleDeleteRow(id: string, title: string) {
    if (!token) {
      showToast('Sign in to delete offers.', 'error')
      return
    }
    if (!window.confirm(`Delete exclusive offer “${title}”? This cannot be undone.`)) return
    try {
      await deleteExclusiveOffer(token, id)
      showToast('Exclusive offer deleted.', 'success')
      void loadPage()
    } catch (e) {
      showApiError(e)
    }
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exclusive offers</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Homepage strip below categories — image cards with chip labels and internal links.
          </p>
        </div>
        <Link
          to="/exclusive-offers/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New offer
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No exclusive offers yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Title
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 md:table-cell">
                    Filter
                  </th>
                  <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:table-cell">
                    Destination
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {items.map((row) => {
                  const st = exclusiveOfferStatus(row)
                  const src = row.imageUrl ? resolveMediaUrl(row.imageUrl) : ''
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="h-14 w-24 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                          {src ? (
                            <img src={src} alt="" className="size-full object-cover" />
                          ) : (
                            <div className="flex size-full items-center justify-center text-[10px] text-slate-400">
                              —
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-3">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-50">{row.title}</p>
                        <p className="truncate text-xs text-slate-500">{row.chipText}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-sm text-slate-600 dark:text-slate-300 md:table-cell">
                        {filterCategoryLabel(filterCategories, row.filterKey)}
                      </td>
                      <td className="hidden max-w-[10rem] truncate px-4 py-3 text-sm text-slate-600 dark:text-slate-300 lg:table-cell">
                        {row.destinationPath?.trim()
                          ? row.destinationPath
                          : '— (display only)'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(st)}`}
                        >
                          {statusLabel(st)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <Link
                          to={`/exclusive-offers/${encodeURIComponent(row.id)}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          View
                        </Link>
                        <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                        <Link
                          to={`/exclusive-offers/${encodeURIComponent(row.id)}/edit`}
                          className="font-medium text-slate-700 hover:underline dark:text-slate-300"
                        >
                          Edit
                        </Link>
                        <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteRow(row.id, row.title)}
                          className="font-medium text-red-600 hover:underline dark:text-red-400"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && total > 0 ? (
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {pageInfo.from}–{pageInfo.to} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
