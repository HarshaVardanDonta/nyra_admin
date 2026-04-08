import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { fetchBlogPromotionsList, type BlogPromotionRecord } from '../lib/api/blog-promotions'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 10

function displayWindow(p: BlogPromotionRecord, nowMs: number): string {
  const start = p.startAt ? new Date(p.startAt).getTime() : NaN
  const end = p.endAt ? new Date(p.endAt).getTime() : NaN
  if (p.startAt && !Number.isNaN(start) && start > nowMs) return 'Scheduled'
  if (p.endAt && !Number.isNaN(end) && end <= nowMs) return 'Ended'
  if (!p.isActive) return 'Inactive'
  return 'Live'
}

export function BlogPromotionsPage() {
  const { token } = useAuth()
  const { showApiError } = useToast()
  const [items, setItems] = useState<BlogPromotionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: t } = await fetchBlogPromotionsList(token, {
        limit: PER_PAGE,
        offset,
      })
      setItems(rows)
      setTotal(t)
    } catch (e) {
      showApiError(e)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [token, page, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))
  const nowMs = Date.now()

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Blog promotions
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Hero modules with image, linked blog, and CTA buttons.
          </p>
        </div>
        <Link
          to="/blog-promotions/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          New promotion
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No blog promotions yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="h-20 w-full shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800 sm:h-16 sm:w-24">
                  {p.imageUrl ? (
                    <img
                      src={resolveMediaUrl(p.imageUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/blog-promotions/${encodeURIComponent(p.id)}`}
                    className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-50 dark:hover:text-blue-400"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-slate-500">Blog: {p.blogId}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {displayWindow(p, nowMs)} · Priority {p.priorityOrder}
                  </p>
                </div>
                <Link
                  to={`/blog-promotions/${encodeURIComponent(p.id)}/edit`}
                  className="shrink-0 text-sm font-medium text-blue-600 dark:text-blue-400"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
        {!loading && totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((x) => Math.max(1, x - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((x) => x + 1)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-slate-700"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
