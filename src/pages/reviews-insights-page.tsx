import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  fetchReviewInsights,
  fetchReviewsList,
  type AdminReviewRow,
  type ReviewInsightsResponse,
} from '../lib/api/reviews'
import { getErrorMessage } from '../lib/api/errors'

function StarBar({
  label,
  count,
  max,
}: {
  label: string
  count: number
  max: number
}) {
  const w = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-8 text-right font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-amber-400/90"
          style={{ width: `${w}%` }}
        />
      </div>
      <span className="w-10 tabular-nums text-slate-500 dark:text-slate-400">{count}</span>
    </div>
  )
}

export function ReviewsInsightsPage() {
  const { token } = useAuth()
  const { showToast } = useToast()
  const [draftFilter, setDraftFilter] = useState('')
  const [appliedFilter, setAppliedFilter] = useState('')
  const [insights, setInsights] = useState<ReviewInsightsResponse | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(true)
  const [rows, setRows] = useState<AdminReviewRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const perPage = 20
  const [loadingTable, setLoadingTable] = useState(true)

  const loadInsights = useCallback(async () => {
    setLoadingInsights(true)
    try {
      const data = await fetchReviewInsights(
        token,
        appliedFilter.trim() || undefined,
      )
      setInsights(data)
    } catch (e) {
      showToast(`Could not load insights: ${getErrorMessage(e)}`, 'error')
      setInsights(null)
    } finally {
      setLoadingInsights(false)
    }
  }, [appliedFilter, showToast, token])

  const loadTable = useCallback(async () => {
    setLoadingTable(true)
    try {
      const res = await fetchReviewsList(token, {
        page,
        perPage,
        productKey: appliedFilter.trim() || undefined,
      })
      setRows(res.reviews)
      setTotal(res.total)
    } catch (e) {
      showToast(`Could not load reviews: ${getErrorMessage(e)}`, 'error')
      setRows([])
      setTotal(0)
    } finally {
      setLoadingTable(false)
    }
  }, [page, appliedFilter, showToast, token])

  useEffect(() => {
    void loadInsights()
  }, [loadInsights])

  useEffect(() => {
    void loadTable()
  }, [loadTable])

  function applyFilter() {
    setAppliedFilter(draftFilter.trim())
    setPage(1)
  }

  const bucketMax = insights?.countByStar?.length
    ? Math.max(1, ...insights.countByStar)
    : 1

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Review insights
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Ratings across the catalog and individual product feedback.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-xs font-medium text-slate-500 dark:text-slate-400">
            Filter by product key
            <input
              type="text"
              placeholder="e.g. prd_12 or slug"
              value={draftFilter}
              onChange={(e) => setDraftFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilter()
              }}
              className="mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            onClick={applyFilter}
          >
            Apply
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total reviews
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-50">
            {loadingInsights ? '…' : insights?.totalReviews ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Average rating
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-50">
            {loadingInsights
              ? '…'
              : insights?.averageRating != null
                ? insights.averageRating.toFixed(2)
                : '—'}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Star distribution</h2>
        <div className="mt-4 max-w-md space-y-2">
          {[5, 4, 3, 2, 1].map((s) => (
            <StarBar
              key={s}
              label={`${s}★`}
              count={insights?.countByStar?.[s - 1] ?? 0}
              max={bucketMax}
            />
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">All reviews</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-700">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Reviewer</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loadingTable ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No reviews yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <Link
                        to={`/products/${encodeURIComponent(r.productKey)}/edit`}
                        className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {r.productName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {r.reviewerFirstName} {r.reviewerLastName}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-600 dark:text-slate-400" title={r.reviewerEmail}>
                      {r.reviewerEmail}
                    </td>
                    <td className="px-4 py-3">{r.rating}★</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-700 dark:text-slate-300" title={r.title}>
                      {r.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > perPage ? (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <span className="text-slate-500">
              Page {page} · {total} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-slate-600"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * perPage >= total}
                className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40 dark:border-slate-600"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
