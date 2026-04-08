import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  fetchBlogsList,
  fetchPopularBlogs,
  type BlogSummary,
  type PopularBlogRow,
} from '../lib/api/blogs'

const PER_PAGE = 10

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function BlogsPage() {
  const { token } = useAuth()
  const { showApiError } = useToast()
  const [items, setItems] = useState<BlogSummary[]>([])
  const [total, setTotal] = useState(0)
  const [popular, setPopular] = useState<PopularBlogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [tagFilter, setTagFilter] = useState('')

  const loadPopular = useCallback(async () => {
    try {
      const p = await fetchPopularBlogs(token, 'week', 6)
      setPopular(p)
    } catch {
      setPopular([])
    }
  }, [token])

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: serverTotal } = await fetchBlogsList(token, {
        limit: PER_PAGE,
        offset,
        tag: tagFilter.trim() || undefined,
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
  }, [token, page, tagFilter, showApiError])

  useEffect(() => {
    void loadPopular()
  }, [loadPopular])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Blogs</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Editorial content, tags, and product references.
          </p>
        </div>
        <Link
          to="/blogs/new"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          New blog
        </Link>
      </div>

      {popular.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Popular this week
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {popular.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/blogs/${encodeURIComponent(p.id)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-800 transition hover:border-blue-500/40 hover:bg-blue-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <span className="max-w-[200px] truncate">{p.title || p.slug}</span>
                  <span className="text-xs text-slate-500">{formatInt(p.viewCount)} views</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Filter by tag
          <input
            type="text"
            value={tagFilter}
            onChange={(e) => {
              setTagFilter(e.target.value)
              setPage(1)
            }}
            placeholder="e.g. skincare"
            className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 sm:w-64"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No blogs yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((b) => (
              <li key={b.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link
                    to={`/blogs/${encodeURIComponent(b.id)}`}
                    className="font-medium text-slate-900 hover:text-blue-600 dark:text-slate-50 dark:hover:text-blue-400"
                  >
                    {b.title}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-slate-500">/{b.slug}</p>
                  {b.tags.length > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">{b.tags.join(' · ')}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={[
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      b.isPublished
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
                    ].join(' ')}
                  >
                    {b.isPublished ? 'Published' : 'Draft'}
                  </span>
                  <Link
                    to={`/blogs/${encodeURIComponent(b.id)}/edit`}
                    className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!loading && totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-800">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => p + 1)}
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
