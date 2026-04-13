import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  deleteExclusiveOffer,
  exclusiveOfferStatus,
  fetchExclusiveOfferAnalytics,
  fetchExclusiveOfferDetail,
  fetchExclusiveOfferFilterCategories,
  filterCategoryLabel,
  type ExclusiveOfferAnalytics,
  type ExclusiveOfferFilterCategory,
  type ExclusiveOfferRecord,
} from '../lib/api/exclusive-offers'
import { resolveMediaUrl } from '../lib/media-url'

function formatTrendPct(n: number) {
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function statusBadgeClass(status: ReturnType<typeof exclusiveOfferStatus>) {
  switch (status) {
    case 'active':
      return 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'scheduled':
      return 'border border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'expired':
      return 'border border-slate-500/40 bg-slate-500/15 text-slate-600 dark:text-slate-400'
    default:
      return 'border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
  }
}

function statusLabel(status: ReturnType<typeof exclusiveOfferStatus>) {
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

export function ExclusiveOfferDetailPage() {
  const { offerId } = useParams<{ offerId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [offer, setOffer] = useState<ExclusiveOfferRecord | null>(null)
  const [analytics, setAnalytics] = useState<ExclusiveOfferAnalytics | null>(null)
  const [filterCategories, setFilterCategories] = useState<ExclusiveOfferFilterCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!offerId) return
    setLoading(true)
    try {
      const o = await fetchExclusiveOfferDetail(token, offerId)
      setOffer(o)
      try {
        const a = await fetchExclusiveOfferAnalytics(token, offerId)
        setAnalytics(a)
      } catch {
        setAnalytics(null)
      }
    } catch (e) {
      showApiError(e)
      setOffer(null)
      setAnalytics(null)
    } finally {
      setLoading(false)
    }
  }, [offerId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

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

  const displayStatus = useMemo(() => (offer ? exclusiveOfferStatus(offer) : 'inactive'), [offer])

  async function handleDelete() {
    if (!token || !offerId || !offer) return
    if (!window.confirm(`Delete “${offer.title}”?`)) return
    setDeleting(true)
    try {
      await deleteExclusiveOffer(token, offerId)
      showToast('Exclusive offer deleted.', 'success')
      navigate('/exclusive-offers')
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !offer) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Offer not found.'}
      </div>
    )
  }

  const imgSrc = offer.imageUrl ? resolveMediaUrl(offer.imageUrl) : ''

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{offer.title}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${statusBadgeClass(displayStatus)}`}
          >
            {statusLabel(displayStatus)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/exclusive-offers/${encodeURIComponent(offer.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Edit
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/20 dark:text-red-300"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <div className="relative aspect-[16/9] max-h-[360px] bg-slate-100 dark:bg-slate-900">
              {imgSrc ? (
                <img src={imgSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">No image</div>
              )}
              <div
                className="absolute left-4 top-4 max-w-[70%] rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase text-white"
                style={{ backgroundColor: offer.chipColor || '#1e293b' }}
              >
                {offer.chipText}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Details</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Subtitle</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-50">{offer.subtitle || '—'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Filter</dt>
                <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-50">
                  {filterCategoryLabel(filterCategories, offer.filterKey)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500">Destination</dt>
                <dd className="mt-0.5 font-mono text-sm font-medium text-slate-900 dark:text-slate-50">
                  {offer.destinationPath?.trim()
                    ? offer.destinationPath
                    : '— (display only — no link on storefront)'}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Analytics (last 30 days)</h2>
            <p className="mt-1 text-xs text-slate-500">Compared to the prior 30 days (UTC).</p>
            {analytics ? (
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Impressions</dt>
                  <dd className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-semibold tabular-nums">{analytics.impressions}</span>
                    <span
                      className={`text-xs font-medium ${
                        analytics.impressionsTrendPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatTrendPct(analytics.impressionsTrendPercent)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Clicks</dt>
                  <dd className="mt-1 flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-semibold tabular-nums">{analytics.clicks}</span>
                    <span
                      className={`text-xs font-medium ${
                        analytics.clicksTrendPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {formatTrendPct(analytics.clicksTrendPercent)}
                    </span>
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Analytics unavailable.</p>
            )}
          </section>
        </div>
      </div>

      <p className="mt-10">
        <Link to="/exclusive-offers" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to exclusive offers
        </Link>
      </p>
    </div>
  )
}
