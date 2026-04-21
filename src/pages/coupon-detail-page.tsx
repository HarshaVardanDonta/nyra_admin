import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  couponDisplayStatus,
  deleteCoupon,
  fetchCouponDetail,
  type CouponRecord,
} from '../lib/api/coupons'

function formatDateTime(iso: string | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
      return 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'scheduled':
      return 'border border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'expired':
      return 'border border-slate-500/40 bg-slate-500/15 text-slate-600 dark:text-slate-400'
    default:
      return 'border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200'
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

function discountTypeLabel(t: string) {
  return t === 'fixed' ? 'Fixed amount' : 'Percentage (%)'
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
      <div className="flex gap-3">
        <span className="shrink-0 text-blue-600 dark:text-blue-400" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

function ReadRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm text-slate-900 dark:text-slate-50">{value}</p>
    </div>
  )
}

export function CouponDetailPage() {
  const { couponId } = useParams<{ couponId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [coupon, setCoupon] = useState<CouponRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)

  const reload = useCallback(async () => {
    if (!couponId) return
    setLoading(true)
    try {
      const c = await fetchCouponDetail(token, couponId)
      setCoupon(c)
    } catch (e) {
      showApiError(e)
      setCoupon(null)
    } finally {
      setLoading(false)
    }
  }, [couponId, token, showApiError])

  useEffect(() => {
    void reload()
  }, [reload])

  const displayStatus = useMemo(
    () => (coupon ? couponDisplayStatus(coupon) : 'inactive'),
    [coupon],
  )

  async function handleDelete() {
    if (!token || !couponId || !coupon) return
    if (!window.confirm(`Delete coupon “${coupon.code}”? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteCoupon(token, couponId)
      showToast('Coupon deleted.', 'success')
      navigate('/coupons')
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading || !coupon) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Coupon not found.'}
      </div>
    )
  }

  const limit = coupon.totalUsageLimit
  const usagePct =
    limit != null && limit > 0 ? Math.min(100, (coupon.timesUsed / limit) * 100) : 0

  const discountValueDisplay =
    coupon.discountType === 'fixed'
      ? formatMoney(coupon.discountValue)
      : `${coupon.discountValue}%`

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <nav className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        <Link to="/coupons" className="transition hover:underline">
          Coupons
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500 dark:text-slate-400">View</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{coupon.code}</h1>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${statusBadgeClass(displayStatus)}`}
          >
            {statusLabel(displayStatus)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/coupons"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Back
          </Link>
          <Link
            to={`/coupons/${encodeURIComponent(coupon.id)}/edit`}
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

      <div className="mx-auto max-w-3xl space-y-6">
        <SectionCard
          title="Basic information"
          description="Core details of this discount."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
              />
            </svg>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Coupon code" value={<span className="font-mono">{coupon.code}</span>} />
            <ReadRow
              label="Active"
              value={coupon.isActive ? 'Yes — coupon flag is on' : 'No — coupon flag is off'}
            />
          </div>
          <div className="mt-4">
            <ReadRow
              label="Description"
              value={
                coupon.description ? (
                  <span className="whitespace-pre-wrap">{coupon.description}</span>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Discount details"
          description="Value and conditions for the discount."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 7.5h6m-6 3h3m-3 3h6m-9 4.5h12a1.5 1.5 0 001.5-1.5v-12a1.5 1.5 0 00-1.5-1.5H6a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 006 19.5z"
              />
            </svg>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Discount type" value={discountTypeLabel(coupon.discountType)} />
            <ReadRow label="Discount value" value={discountValueDisplay} />
            <ReadRow
              label="Minimum order value"
              value={coupon.minimumOrderValue > 0 ? formatMoney(coupon.minimumOrderValue) : '—'}
            />
            <ReadRow
              label="Maximum discount"
              value={
                coupon.maximumDiscount != null ? formatMoney(coupon.maximumDiscount) : '— (none)'
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Exclusions"
          description="Categories (including subcategories) and products that do not receive this discount."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728"
              />
            </svg>
          }
        >
          <ReadRow
            label="Excluded categories"
            value={
              (coupon.excludedCategoryIds?.length ?? 0) > 0 ? (
                <ul className="list-inside list-disc space-y-1">
                  {coupon.excludedCategoryIds!.map((id) => (
                    <li key={id} className="font-mono text-xs">
                      {id}
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              )
            }
          />
          <div className="mt-4">
            <ReadRow
              label="Excluded products"
              value={
                (coupon.excludedProductIds?.length ?? 0) > 0 ? (
                  <ul className="list-inside list-disc space-y-1">
                    {coupon.excludedProductIds!.map((id) => (
                      <li key={id} className="font-mono text-xs">
                        {id}
                      </li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Usage limits"
          description="How this coupon can be redeemed."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadRow
              label="Total usage"
              value={
                limit != null ? (
                  <span>
                    {coupon.timesUsed} / {limit}
                  </span>
                ) : (
                  <span>
                    {coupon.timesUsed} / <span className="text-slate-500">Unlimited</span>
                  </span>
                )
              }
            />
            <ReadRow label="Usage per customer" value={String(coupon.usagePerCustomer)} />
          </div>
          {limit != null && limit > 0 ? (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] dark:bg-blue-500"
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Schedule"
          description="When the code is valid."
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5a2.25 2.25 0 002.25-2.25m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5a2.25 2.25 0 012.25 2.25v7.5"
              />
            </svg>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadRow label="Start date & time" value={formatDateTime(coupon.startDate)} />
            <ReadRow label="Expiration date & time" value={formatDateTime(coupon.expirationDate)} />
          </div>
        </SectionCard>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Metadata</h2>
          <ul className="mt-4 space-y-3 border-l border-slate-200 pl-4 text-sm dark:border-slate-700">
            <li>
              <p className="text-xs text-slate-500 dark:text-slate-400">Coupon ID</p>
              <p className="mt-0.5 font-mono text-xs text-slate-800 dark:text-slate-200">{coupon.id}</p>
            </li>
            <li>
              <p className="text-xs text-slate-500 dark:text-slate-400">Created</p>
              <p className="mt-0.5">{formatDateTime(coupon.createdAt)}</p>
            </li>
            <li>
              <p className="text-xs text-slate-500 dark:text-slate-400">Last updated</p>
              <p className="mt-0.5">{formatDateTime(coupon.updatedAt)}</p>
            </li>
          </ul>
        </section>
      </div>

      <p className="mt-10 text-center text-xs text-slate-500 dark:text-slate-500">
        <Link to="/coupons" className="text-blue-600 hover:underline dark:text-blue-400">
          ← Back to coupons
        </Link>
      </p>
    </div>
  )
}
