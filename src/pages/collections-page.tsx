import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  collectionSlugSegment,
  deleteCollection,
  fetchCollectionsList,
  type CollectionRecord,
  type CollectionSort,
  type CollectionStatusFilter,
} from '../lib/api/collections'
import { resolveMediaUrl } from '../lib/media-url'

const PER_PAGE = 8

const PLACEHOLDER_BGS = [
  'bg-blue-600/90',
  'bg-teal-600/90',
  'bg-amber-800/90',
  'bg-slate-600/90',
  'bg-violet-600/90',
]

function hashPick(id: string, mod: number) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return h % mod
}

function formatDate(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function CollectionsPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()

  const [items, setItems] = useState<CollectionRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<CollectionStatusFilter>('all')
  const [sort, setSort] = useState<CollectionSort>('name_asc')

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const offset = (page - 1) * PER_PAGE
      const { items: rows, total: serverTotal } = await fetchCollectionsList(token, {
        limit: PER_PAGE,
        offset,
        status: statusFilter,
        sort,
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
  }, [token, page, statusFilter, sort, showApiError])

  useEffect(() => {
    void loadPage()
  }, [loadPage])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, sort])

  const pageInfo = useMemo(() => {
    const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1
    const to = Math.min(page * PER_PAGE, total)
    return { from, to }
  }, [page, total])

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  async function handleDeleteRow(id: string, name: string) {
    if (!token) {
      showToast('Sign in to delete collections.', 'error')
      return
    }
    if (!window.confirm(`Delete collection “${name}”? This cannot be undone.`)) return
    try {
      await deleteCollection(token, id)
      showToast('Collection deleted.', 'success')
      void loadPage()
    } catch (e) {
      showApiError(e)
    }
  }

  return (
    <div className="bg-[#0b0e14] p-6 pb-28 text-slate-50 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Collections</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your storefront&apos;s product groups and banners.
          </p>
        </div>
        <Link
          to="/collections/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </span>
          Create Collection
        </Link>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#151b23] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1419] px-3 py-2 text-sm text-slate-300">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M3 8h18M3 12h18M3 16h18" />
            </svg>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CollectionStatusFilter)}
              className="cursor-pointer border-none bg-transparent text-sm font-medium text-slate-200 outline-none"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1419] px-3 py-2 text-sm text-slate-300">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <select
              disabled
              className="cursor-not-allowed border-none bg-transparent text-sm font-medium text-slate-500 outline-none"
              title="Date range filter is not available yet"
            >
              <option>All Time</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1419] px-3 py-2 text-sm text-slate-300">
            <span className="text-xs font-semibold text-slate-500">A–Z</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as CollectionSort)}
              className="cursor-pointer border-none bg-transparent text-sm font-medium text-slate-200 outline-none"
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
            </select>
          </label>
        </div>
        <p className="text-sm text-slate-500">
          Showing {formatInt(pageInfo.from)}–{formatInt(pageInfo.to)} of {formatInt(total)} collections
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#151b23] shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-4">Collection image</th>
                <th className="px-5 py-4">Collection name</th>
                <th className="px-5 py-4">Products</th>
                <th className="px-5 py-4">Created</th>
                <th className="px-5 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-slate-500">
                    No collections yet. Create one to group products on the storefront.
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const ph = PLACEHOLDER_BGS[hashPick(row.id, PLACEHOLDER_BGS.length)]
                  const thumb = row.thumbnailUrl ? resolveMediaUrl(row.thumbnailUrl) : ''
                  const seg = collectionSlugSegment(row.slug)
                  return (
                    <tr key={row.id} className="transition hover:bg-slate-800/40">
                      <td className="px-5 py-4">
                        <div
                          className={`flex h-14 w-24 items-center justify-center overflow-hidden rounded-lg ${
                            thumb ? '' : ph
                          }`}
                        >
                          {thumb ? (
                            <img src={thumb} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <svg className="h-7 w-7 text-white/90" fill="none" viewBox="0 0 24 24" strokeWidth={1.25} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{row.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          slug: <span className="font-mono text-slate-400">{seg || '—'}</span>
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-300">
                          {formatInt(row.productCount)} Products
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-400">{formatDate(row.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/collections/${encodeURIComponent(row.id)}`}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                            title="View"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </Link>
                          <Link
                            to={`/collections/${encodeURIComponent(row.id)}/edit`}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                            title="Edit"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                              />
                            </svg>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRow(row.id, row.name)}
                            className="rounded-lg p-2 text-slate-400 transition hover:bg-red-950/50 hover:text-red-400"
                            title="Delete"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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

        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-800 px-5 py-4 text-sm text-slate-500 sm:flex-row">
          <p className="tabular-nums">
            Page {page} / {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
            >
              Next
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
