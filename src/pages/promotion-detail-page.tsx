import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import { deletePromotion, fetchPromotionDetail, promotionDisplayStatus, type PromotionRecord } from '../lib/api/promotions'
import { resolveMediaUrl } from '../lib/media-url'

function formatDateLong(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function statusBadgeClass(status: ReturnType<typeof promotionDisplayStatus>) {
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

function statusLabel(status: ReturnType<typeof promotionDisplayStatus>) {
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

function remainingLabel(p: PromotionRecord): string {
  const exp = p.expirationDate ? new Date(p.expirationDate).getTime() : NaN
  if (!p.expirationDate || Number.isNaN(exp)) return '—'
  const now = Date.now()
  if (exp <= now) return 'Ended'
  const days = Math.ceil((exp - now) / (86400 * 1000))
  return `${days} day${days === 1 ? '' : 's'} left`
}

export function PromotionDetailPage() {
  const { promotionId } = useParams<{ promotionId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [promo, setPromo] = useState<PromotionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!promotionId) return
    setLoading(true)
    try {
      const p = await fetchPromotionDetail(token, promotionId)
      setPromo(p)
    } catch (e) {
      showApiError(e)
      setPromo(null)
    } finally {
      setLoading(false)
    }
  }, [promotionId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  const displayStatus = useMemo(() => (promo ? promotionDisplayStatus(promo) : 'inactive'), [promo])

  async function handleDelete() {
    if (!token || !promotionId || !promo) return
    if (!window.confirm(`Delete promotion “${promo.title}”?`)) return
    setDeleting(true)
    try {
      await deletePromotion(token, promotionId)
      showToast('Promotion deleted.', 'success')
      navigate('/promotions')
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !promo) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Promotion not found.'}
      </div>
    )
  }

  const bannerSrc = promo.bannerImageUrl ? resolveMediaUrl(promo.bannerImageUrl) : ''

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{promo.title}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${statusBadgeClass(displayStatus)}`}
          >
            {statusLabel(displayStatus)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/promotions/${encodeURIComponent(promo.id)}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125"
              />
            </svg>
            Edit
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/20 dark:text-red-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
              />
            </svg>
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <div className="relative aspect-[21/9] max-h-[320px] bg-slate-100 dark:bg-slate-900">
              {bannerSrc ? (
                <img src={bannerSrc} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">No banner</div>
              )}
              <Link
                to={`/promotions/${encodeURIComponent(promo.id)}/edit`}
                className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-lg bg-slate-900/85 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-slate-900 dark:bg-black/70"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                Change banner
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Promotion overview</h2>
            <ul className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="text-slate-400" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Redirect target</p>
                  {promo.targetType ? (
                    <p className="mt-0.5 text-slate-900 dark:text-slate-50">
                      <span className="text-slate-500 dark:text-slate-400">{promo.targetType}:</span>{' '}
                      <span className="font-medium text-blue-600 dark:text-blue-400">{promo.targetLabel || '—'}</span>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-slate-500">None</p>
                  )}
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-slate-400" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Duration</p>
                  <p className="mt-0.5 text-slate-900 dark:text-slate-50">
                    {formatDateLong(promo.startDate)} — {formatDateLong(promo.expirationDate)}
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-slate-400" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Type</p>
                  <p className="mt-0.5 text-slate-900 dark:text-slate-50">Banner promotion</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="text-slate-400" aria-hidden>
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Remaining</p>
                  <p className="mt-0.5 font-medium text-emerald-600 dark:text-emerald-400">{remainingLabel(promo)}</p>
                </div>
              </li>
            </ul>
            {promo.description ? (
              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{promo.description}</p>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Performance analytics</h2>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                Not tracked
              </span>
            </div>
            <div className="mt-6 flex min-h-[140px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">No click data yet</p>
              <p className="mt-1 max-w-sm px-4 text-xs text-slate-500 dark:text-slate-400">
                Impression and click tracking can be added when the storefront reports events to the API.
              </p>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Settings</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Priority order</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-50">
                  #{promo.priorityOrder}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Lower numbers appear first in API ordering.</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Active flag</p>
                <p className="mt-1 font-medium text-slate-900 dark:text-slate-50">{promo.isActive ? 'On' : 'Off'}</p>
              </div>
              <Link
                to={`/promotions/${encodeURIComponent(promo.id)}/edit`}
                className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Change in editor →
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Recent activity</h2>
            <ul className="mt-4 space-y-4 border-l border-slate-200 pl-4 dark:border-slate-700">
              <li className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden />
                <p className="text-sm text-slate-900 dark:text-slate-50">Last updated</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(promo.updatedAt)}</p>
              </li>
              <li className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400" aria-hidden />
                <p className="text-sm text-slate-900 dark:text-slate-50">Created</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(promo.createdAt)}</p>
              </li>
            </ul>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              Full audit history is not available yet.
            </p>
          </section>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-500">
        <Link to="/promotions" className="text-blue-600 hover:underline dark:text-blue-400">
          ← Back to promotions
        </Link>
      </p>
    </div>
  )
}
