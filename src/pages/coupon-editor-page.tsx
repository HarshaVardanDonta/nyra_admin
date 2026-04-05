import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  createCoupon,
  fetchCouponDetail,
  generateCouponCodePreview,
  updateCoupon,
  type CouponDiscountType,
  type CouponWriteInput,
} from '../lib/api/coupons'
import { AdminDateTimeField } from '../components/admin-date-field'
import { datetimeLocalToIso, isoToDatetimeLocal } from '../lib/datetime-local'

function parseOptionalPositiveInt(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number.parseInt(t, 10)
  if (!Number.isFinite(n) || n < 1) return undefined
  return n
}

function parseMoney(s: string): number {
  const t = s.trim().replace(/,/g, '')
  if (!t) return 0
  const n = Number.parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

const defaultForm = (): CouponWriteInput => ({
  code: '',
  description: '',
  isActive: true,
  discountType: 'percentage',
  discountValue: 0,
  minimumOrderValue: 0,
  maximumDiscount: undefined,
  totalUsageLimit: undefined,
  usagePerCustomer: 1,
  startDate: undefined,
  expirationDate: undefined,
})

function recordToForm(
  code: string,
  description: string,
  isActive: boolean,
  discountType: CouponDiscountType,
  discountValue: number,
  minimumOrderValue: number,
  maximumDiscount: number | undefined,
  totalUsageLimit: number | undefined,
  usagePerCustomer: number,
  startDate: string | undefined,
  expirationDate: string | undefined,
): CouponWriteInput {
  return {
    code,
    description,
    isActive,
    discountType,
    discountValue,
    minimumOrderValue,
    maximumDiscount,
    totalUsageLimit,
    usagePerCustomer,
    startDate,
    expirationDate,
  }
}

function Toggle({
  checked,
  onChange,
  id,
  label,
  sub,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  id: string
  label: string
  sub?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-[#0f1419]">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {label}
        </label>
        {sub ? <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-blue-600' : 'bg-slate-400 dark:bg-slate-600'
        }`}
      >
        <span
          className={`absolute top-1 left-1 block h-5 w-5 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
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
          <div className="mt-4 space-y-4">{children}</div>
        </div>
      </div>
    </section>
  )
}

function inputClass() {
  return [
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
    'placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
    'dark:border-slate-700 dark:bg-[#0a0c10] dark:text-slate-100 dark:placeholder:text-slate-500',
  ].join(' ')
}

export function CouponEditorPage() {
  const { couponId } = useParams<{ couponId: string }>()
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()
  const baseId = useId()

  const isEdit = Boolean(couponId)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [discountType, setDiscountType] = useState<CouponDiscountType>('percentage')
  const [discountValueStr, setDiscountValueStr] = useState('')
  const [minOrderStr, setMinOrderStr] = useState('')
  const [maxDiscountStr, setMaxDiscountStr] = useState('')
  const [totalLimitStr, setTotalLimitStr] = useState('')
  const [usagePerCustomerStr, setUsagePerCustomerStr] = useState('1')
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')

  const applyLoaded = useCallback((input: CouponWriteInput, startL: string, endL: string) => {
    setCode(input.code)
    setDescription(input.description)
    setIsActive(input.isActive)
    setDiscountType(input.discountType)
    setDiscountValueStr(
      input.discountValue > 0 ? String(input.discountValue) : '',
    )
    setMinOrderStr(input.minimumOrderValue > 0 ? String(input.minimumOrderValue) : '')
    setMaxDiscountStr(
      input.maximumDiscount != null && input.maximumDiscount > 0
        ? String(input.maximumDiscount)
        : '',
    )
    setTotalLimitStr(
      input.totalUsageLimit != null && input.totalUsageLimit > 0
        ? String(input.totalUsageLimit)
        : '',
    )
    setUsagePerCustomerStr(String(Math.max(1, input.usagePerCustomer)))
    setStartLocal(startL)
    setEndLocal(endL)
  }, [])

  const loadEdit = useCallback(async () => {
    if (!couponId || !token) return
    setLoading(true)
    try {
      const c = await fetchCouponDetail(token, couponId)
      const input = recordToForm(
        c.code,
        c.description,
        c.isActive,
        c.discountType === 'fixed' ? 'fixed' : 'percentage',
        c.discountValue,
        c.minimumOrderValue,
        c.maximumDiscount,
        c.totalUsageLimit,
        c.usagePerCustomer,
        c.startDate,
        c.expirationDate,
      )
      applyLoaded(input, isoToDatetimeLocal(c.startDate), isoToDatetimeLocal(c.expirationDate))
    } catch (e) {
      showApiError(e)
    } finally {
      setLoading(false)
    }
  }, [couponId, token, showApiError, applyLoaded])

  useEffect(() => {
    if (isEdit) void loadEdit()
  }, [isEdit, loadEdit])

  function buildWriteInput(): CouponWriteInput | null {
    const discountValue = parseMoney(discountValueStr)
    if (discountValue <= 0) {
      showToast('Discount value must be greater than zero.', 'error')
      return null
    }
    if (discountType === 'percentage' && discountValue > 100) {
      showToast('Percentage discount cannot exceed 100.', 'error')
      return null
    }
    const usagePerCustomer = Number.parseInt(usagePerCustomerStr, 10)
    if (!Number.isFinite(usagePerCustomer) || usagePerCustomer < 1) {
      showToast('Usage per customer must be at least 1.', 'error')
      return null
    }
    if (isEdit && !code.trim()) {
      showToast('Coupon code is required.', 'error')
      return null
    }
    const totalLimit = parseOptionalPositiveInt(totalLimitStr)
    const maxDisc = parseMoney(maxDiscountStr)
    return {
      code: code.trim(),
      description,
      isActive,
      discountType,
      discountValue,
      minimumOrderValue: parseMoney(minOrderStr),
      maximumDiscount: maxDisc > 0 ? maxDisc : undefined,
      totalUsageLimit: totalLimit,
      usagePerCustomer,
      startDate: datetimeLocalToIso(startLocal),
      expirationDate: datetimeLocalToIso(endLocal),
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!token) {
      showToast('Sign in to save.', 'error')
      return
    }
    const input = buildWriteInput()
    if (!input) return
    setSaving(true)
    try {
      if (isEdit && couponId) {
        await updateCoupon(token, couponId, input)
        showToast('Coupon updated.', 'success')
        navigate(`/coupons/${encodeURIComponent(couponId)}`)
      } else {
        const created = await createCoupon(token, input)
        showToast('Coupon created.', 'success')
        navigate(`/coupons/${encodeURIComponent(created.id)}`)
      }
    } catch (err) {
      showApiError(err)
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    if (isEdit) {
      void loadEdit()
      return
    }
    const d = defaultForm()
    applyLoaded(d, '', '')
    setDiscountValueStr('')
    setMinOrderStr('')
    setMaxDiscountStr('')
    setTotalLimitStr('')
    setUsagePerCustomerStr('1')
  }

  function handleGenerateCode() {
    setCode(generateCouponCodePreview())
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        Loading…
      </div>
    )
  }

  return (
    <div className="min-w-0 px-4 pt-6 pb-32 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <form onSubmit={(ev) => void handleSubmit(ev)}>
        <nav className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
          <Link to="/coupons" className="transition hover:underline">
            Coupons
          </Link>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-500 dark:text-slate-400">{isEdit ? 'Edit coupon' : 'Create coupon'}</span>
        </nav>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">
            {isEdit ? `Edit: ${code || 'Coupon'}` : 'New discount code'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/coupons"
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save coupon'}
            </button>
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-6">
          <SectionCard
            title="Basic information"
            description="Define the core details of your discount."
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
            <div>
              <label htmlFor={`${baseId}-code`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Coupon code
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id={`${baseId}-code`}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SUMMER24"
                  className={`${inputClass()} sm:max-w-xs sm:flex-1`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="shrink-0 rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-600/10 dark:border-blue-500 dark:text-blue-400"
                >
                  Generate
                </button>
              </div>
              {!isEdit ? (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                  Leave blank and save to let the server assign a unique code.
                </p>
              ) : null}
            </div>
            <Toggle
              id={`${baseId}-active`}
              checked={isActive}
              onChange={setIsActive}
              label="Coupon is currently active"
            />
            <div>
              <label htmlFor={`${baseId}-desc`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Description
              </label>
              <textarea
                id={`${baseId}-desc`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the terms or details of this coupon…"
                rows={4}
                className={inputClass()}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Discount details"
            description="Set the value and conditions for the discount."
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
              <div>
                <label htmlFor={`${baseId}-dtype`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Discount type
                </label>
                <select
                  id={`${baseId}-dtype`}
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value === 'fixed' ? 'fixed' : 'percentage')}
                  className={`${inputClass()} select-tail`}
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed amount (₹)</option>
                </select>
              </div>
              <div>
                <label htmlFor={`${baseId}-dval`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Discount value
                </label>
                <input
                  id={`${baseId}-dval`}
                  type="text"
                  inputMode="decimal"
                  value={discountValueStr}
                  onChange={(e) => setDiscountValueStr(e.target.value)}
                  placeholder="0.00"
                  className={inputClass()}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-min`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Minimum order value (₹)
                </label>
                <input
                  id={`${baseId}-min`}
                  type="text"
                  inputMode="decimal"
                  value={minOrderStr}
                  onChange={(e) => setMinOrderStr(e.target.value)}
                  placeholder="0.00"
                  className={inputClass()}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-max`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Maximum discount (₹, optional)
                </label>
                <input
                  id={`${baseId}-max`}
                  type="text"
                  inputMode="decimal"
                  value={maxDiscountStr}
                  onChange={(e) => setMaxDiscountStr(e.target.value)}
                  placeholder="0.00"
                  className={inputClass()}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Usage limits"
            description="Control how many times this coupon can be redeemed."
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
              <div>
                <label htmlFor={`${baseId}-total`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Total usage limit
                </label>
                <input
                  id={`${baseId}-total`}
                  type="text"
                  inputMode="numeric"
                  value={totalLimitStr}
                  onChange={(e) => setTotalLimitStr(e.target.value)}
                  placeholder="Unlimited"
                  className={inputClass()}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-per`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Usage per customer
                </label>
                <input
                  id={`${baseId}-per`}
                  type="text"
                  inputMode="numeric"
                  value={usagePerCustomerStr}
                  onChange={(e) => setUsagePerCustomerStr(e.target.value)}
                  placeholder="1"
                  className={inputClass()}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Schedule"
            description="Set the availability period for the discount code."
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
              <div>
                <label htmlFor={`${baseId}-start`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Start date &amp; time
                </label>
                <AdminDateTimeField id={`${baseId}-start`} value={startLocal} onChange={setStartLocal} className={inputClass()} />
              </div>
              <div>
                <label htmlFor={`${baseId}-end`} className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Expiration date &amp; time
                </label>
                <AdminDateTimeField id={`${baseId}-end`} value={endLocal} onChange={setEndLocal} className={inputClass()} />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Discard changes
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create coupon code'}
          </button>
        </div>
      </form>
    </div>
  )
}
