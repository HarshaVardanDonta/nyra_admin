import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  createCustomerAddress,
  deleteCustomer,
  deleteCustomerAddress,
  downloadCustomerOrdersExport,
  fetchCustomerActivity,
  fetchCustomerDetails,
  fetchCustomerOrders,
  setDefaultCustomerAddress,
  type CustomerActivityItem,
  type CustomerDetailAddress,
  type CustomerDetailView,
  type CustomerOrderRow,
} from '../lib/api/customers'
import { resolveMediaUrl } from '../lib/media-url'

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatDateShort(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function trendColor(trend: string) {
  const t = trend.toLowerCase()
  if (t.includes('down') || t.includes('neg')) return 'text-red-500 dark:text-red-400'
  if (t.includes('up') || t.includes('pos')) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-slate-500 dark:text-slate-400'
}

function fulfillmentDotClass(status: string) {
  const s = status.toLowerCase()
  if (s.includes('deliver') || s.includes('complete')) return 'bg-emerald-500'
  if (s.includes('ship') || s.includes('dispatch')) return 'bg-blue-500'
  if (s.includes('cancel')) return 'bg-red-500'
  return 'bg-slate-400'
}

function ActivityIcon({ eventType }: { eventType: string }) {
  const t = eventType.toLowerCase()
  const className = 'h-4 w-4'
  if (t.includes('order') && t.includes('place')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
      </svg>
    )
  }
  if (t.includes('address') || t.includes('shipping')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
  if (t.includes('deliver')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (t.includes('account') || t.includes('created')) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  }
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const ORDERS_PER_PAGE = 8

export function CustomerDetailPage() {
  const { customerId: customerIdParam } = useParams<{ customerId: string }>()
  const customerId = Number(customerIdParam)
  const navigate = useNavigate()
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const [detail, setDetail] = useState<CustomerDetailView | null>(null)
  const [orders, setOrders] = useState<CustomerOrderRow[]>([])
  const [orderPag, setOrderPag] = useState({ page: 1, total: 0, totalPages: 0 })
  const [orderPage, setOrderPage] = useState(1)
  const [activity, setActivity] = useState<CustomerActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [orderStatusFilter, setOrderStatusFilter] = useState('')
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [exportingOrders, setExportingOrders] = useState(false)
  const [addressModal, setAddressModal] = useState(false)
  const [addressSaving, setAddressSaving] = useState(false)
  const [addrForm, setAddrForm] = useState({
    label: 'Shipping',
    tag: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    isDefault: false,
  })

  const reloadDetail = useCallback(async () => {
    if (!token || !Number.isFinite(customerId) || customerId <= 0) return
    const d = await fetchCustomerDetails(token, customerId)
    setDetail(d)
  }, [token, customerId])

  const reloadOrders = useCallback(
    async (page: number) => {
      if (!token || !Number.isFinite(customerId) || customerId <= 0) return
      setOrdersLoading(true)
      try {
        const { items, pagination } = await fetchCustomerOrders(token, customerId, {
          page,
          perPage: ORDERS_PER_PAGE,
          status: orderStatusFilter.trim() || undefined,
        })
        setOrders(items)
        setOrderPag({
          page: pagination.page,
          total: pagination.total,
          totalPages: Math.max(1, pagination.totalPages || 1),
        })
      } catch (e) {
        showApiError(e)
        setOrders([])
      } finally {
        setOrdersLoading(false)
      }
    },
    [token, customerId, orderStatusFilter, showApiError],
  )

  useLayoutEffect(() => {
    setOrderPage(1)
  }, [customerId, orderStatusFilter])

  useEffect(() => {
    if (!token || !Number.isFinite(customerId) || customerId <= 0) {
      setDetail(null)
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setDetail(null)
      setActivity([])
      try {
        const [d, act] = await Promise.all([
          fetchCustomerDetails(token, customerId),
          fetchCustomerActivity(token, customerId, 1, 25),
        ])
        if (cancelled) return
        setDetail(d)
        setActivity(act.items)
      } catch (e) {
        if (!cancelled) {
          showApiError(e)
          setDetail(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token, customerId, showApiError])

  useEffect(() => {
    if (!token || !Number.isFinite(customerId) || customerId <= 0) return
    void reloadOrders(orderPage)
  }, [token, customerId, orderPage, reloadOrders])

  async function handleDeleteCustomer() {
    if (!token || !detail) return
    if (!window.confirm(`Delete customer “${detail.profile.name}”? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deleteCustomer(token, customerId)
      showToast('Customer deleted.', 'success')
      navigate('/customers', { replace: true })
    } catch (e) {
      showApiError(e)
    } finally {
      setDeleting(false)
    }
  }

  async function handleOrdersExport() {
    if (!token) return
    setExportingOrders(true)
    try {
      await downloadCustomerOrdersExport(token, customerId, {
        status: orderStatusFilter.trim() || undefined,
      })
      showToast('Order export started.', 'success')
    } catch (e) {
      showApiError(e)
    } finally {
      setExportingOrders(false)
    }
  }

  async function submitAddress(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setAddressSaving(true)
    try {
      await createCustomerAddress(token, customerId, {
        label: addrForm.label.trim(),
        tag: addrForm.tag.trim(),
        addressLine1: addrForm.addressLine1.trim(),
        addressLine2: addrForm.addressLine2.trim(),
        city: addrForm.city.trim(),
        state: addrForm.state.trim(),
        zip: addrForm.zip.trim(),
        country: addrForm.country.trim(),
        isDefault: addrForm.isDefault,
      })
      showToast('Address added.', 'success')
      setAddressModal(false)
      setAddrForm({
        label: 'Shipping',
        tag: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        zip: '',
        country: '',
        isDefault: false,
      })
      await reloadDetail()
    } catch (err) {
      showApiError(err)
    } finally {
      setAddressSaving(false)
    }
  }

  async function handleDeleteAddress(a: CustomerDetailAddress) {
    if (!token) return
    if (!window.confirm('Remove this address?')) return
    try {
      await deleteCustomerAddress(token, customerId, a.id)
      showToast('Address removed.', 'success')
      await reloadDetail()
    } catch (e) {
      showApiError(e)
    }
  }

  async function handleSetDefault(a: CustomerDetailAddress) {
    if (!token || a.isDefault) return
    try {
      await setDefaultCustomerAddress(token, customerId, a.id)
      showToast('Default address updated.', 'success')
      await reloadDetail()
    } catch (e) {
      showApiError(e)
    }
  }

  if (!Number.isFinite(customerId) || customerId <= 0) {
    return (
      <div className="min-w-0 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 sm:px-6 lg:p-10">
        Invalid customer id.
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-w-0 px-4 py-6 text-sm text-slate-500 dark:text-slate-400 sm:px-6 lg:p-10">
        Sign in to view this customer.
      </div>
    )
  }

  if (loading || !detail) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
        {loading ? 'Loading…' : 'Customer not found.'}
      </div>
    )
  }

  const { profile, kpis, addresses } = detail
  const img = profile.avatarUrl ? resolveMediaUrl(profile.avatarUrl) : ''
  const statusActive = profile.status.toLowerCase() === 'active'
  const membershipLine = (() => {
    const tier = profile.membershipTier.trim()
    const y = profile.membershipSince
    if (tier && y) return `${tier} member since ${y}`
    if (tier) return tier
    if (y) return `Member since ${y}`
    return 'Customer'
  })()
  const mailto = profile.email ? `mailto:${encodeURIComponent(profile.email)}` : ''

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <nav className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
        <Link to="/customers" className="transition hover:underline">
          Customers
        </Link>
        <span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-500 dark:text-slate-400">Details</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Customer Details: {profile.name}
        </h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/customers/${customerId}/edit`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-[#0f1419] dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            Edit Customer
          </Link>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDeleteCustomer()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 bg-white px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/5 disabled:opacity-50 dark:bg-[#0f1419] dark:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {deleting ? 'Deleting…' : 'Delete Customer'}
          </button>
        </div>
      </div>

      <div className="min-w-0 grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <div className="flex flex-col items-center text-center">
              <div
                className="mb-3 h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700"
                style={img ? undefined : { backgroundColor: profile.avatarColor }}
              >
                {img ? (
                  <img src={img} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-white">
                    {profile.initials}
                  </div>
                )}
              </div>
              <span
                className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  statusActive
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400'
                }`}
              >
                {profile.status || '—'}
              </span>
              <h2 className="text-lg font-semibold">{profile.name}</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{membershipLine}</p>
            </div>
            <ul className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-slate-400" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </span>
                <span className="break-all">{profile.email || '—'}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-slate-400" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </span>
                {profile.phone || '—'}
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-slate-400" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </span>
                Joined {formatDateShort(profile.joinedDate)}
              </li>
            </ul>
            {mailto ? (
              <a
                href={mailto}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Send Message
              </a>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Saved Addresses</h3>
              <button
                type="button"
                onClick={() => setAddressModal(true)}
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Add New
              </button>
            </div>
            <ul className="space-y-4">
              {addresses.length === 0 ? (
                <li className="text-sm text-slate-500 dark:text-slate-400">No addresses yet.</li>
              ) : (
                addresses.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-slate-100 p-3 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex gap-2">
                        <span className="text-slate-400" aria-hidden>
                          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </span>
                        <div>
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{a.label}</p>
                          <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{a.fullAddress}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {a.isDefault ? (
                              <span className="rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-600 dark:text-blue-400">
                                Default
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => void handleSetDefault(a)}
                                className="text-[10px] font-semibold uppercase text-blue-600 hover:underline dark:text-blue-400"
                              >
                                Set default
                              </button>
                            )}
                            {a.tag ? (
                              <span className="rounded bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400">
                                {a.tag}
                              </span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void handleDeleteAddress(a)}
                              className="text-[10px] font-semibold uppercase text-red-600 hover:underline dark:text-red-400"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Orders</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatInt(kpis.totalOrders.value)}</p>
              <p className={`mt-1 text-xs ${trendColor(kpis.totalOrders.trend)}`}>
                {kpis.totalOrders.changePercent >= 0 ? '+' : ''}
                {kpis.totalOrders.changePercent}% {kpis.totalOrders.vsLabel || 'vs prior year'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Total Spent</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(kpis.totalSpent.value)}</p>
              <p className={`mt-1 text-xs ${trendColor(kpis.totalSpent.trend)}`}>
                {kpis.totalSpent.changePercent >= 0 ? '+' : ''}
                {kpis.totalSpent.changePercent}%
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Avg. Order</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{formatMoney(kpis.avgOrderValue.value)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {kpis.avgOrderValue.trendLabel || 'Steady'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Last Order</p>
              <p className="mt-2 text-xl font-semibold">{kpis.lastOrder.relativeLabel || '—'}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {formatDateShort(kpis.lastOrder.date)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-semibold">Order History</h3>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="search"
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                  placeholder="Filter by fulfillment status…"
                  className="min-w-[12rem] rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  title="Download CSV"
                  disabled={exportingOrders}
                  onClick={() => void handleOrdersExport()}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
                    />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:border-slate-800">
                    <th className="px-4 py-3">Order ID</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Items</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ordersLoading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading orders…
                      </td>
                    </tr>
                  ) : orders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No orders yet.
                      </td>
                    </tr>
                  ) : (
                    orders.map((o) => (
                      <tr key={o.orderId} className="bg-white dark:bg-[#0f1419]">
                        <td className="px-4 py-3 font-mono text-xs text-blue-600 dark:text-blue-400">#{o.orderId}</td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{formatDateShort(o.date)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatInt(o.itemsCount)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatMoney(o.total)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                            {o.paymentStatus || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2 text-slate-700 dark:text-slate-300">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${fulfillmentDotClass(o.fulfillmentStatus)}`} />
                            {o.fulfillmentStatus || '—'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
              <Link
                to="/customers"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                View all customers
              </Link>
              {orderPag.totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={orderPage <= 1 || ordersLoading}
                    onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {orderPag.page} / {orderPag.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={orderPage >= orderPag.totalPages || ordersLoading}
                    onClick={() => setOrderPage((p) => p + 1)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-slate-700"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0f1419]">
            <h3 className="mb-4 text-sm font-semibold">Recent Activity</h3>
            <ul className="space-y-4">
              {activity.length === 0 ? (
                <li className="text-sm text-slate-500 dark:text-slate-400">No activity recorded.</li>
              ) : (
                activity.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <ActivityIcon eventType={ev.eventType} />
                    </span>
                    <div className="min-w-0 flex-1 border-l border-slate-100 pb-4 pl-4 dark:border-slate-800">
                      <p className="text-sm text-slate-800 dark:text-slate-200">{ev.description}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {ev.relativeTime || formatDateTime(ev.createdAt)}
                        {ev.absoluteTime ? ` · ${ev.absoluteTime}` : ''}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>

      {addressModal ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="addr-modal-title"
          onClick={() => setAddressModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="addr-modal-title" className="text-lg font-semibold">
              Add address
            </h2>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitAddress(e)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Label
                  <input
                    value={addrForm.label}
                    onChange={(e) => setAddrForm((f) => ({ ...f, label: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Tag (optional)
                  <input
                    value={addrForm.tag}
                    onChange={(e) => setAddrForm((f) => ({ ...f, tag: e.target.value }))}
                    placeholder="HOME, WORK…"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Address line 1
                <input
                  required
                  value={addrForm.addressLine1}
                  onChange={(e) => setAddrForm((f) => ({ ...f, addressLine1: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Address line 2
                <input
                  value={addrForm.addressLine2}
                  onChange={(e) => setAddrForm((f) => ({ ...f, addressLine2: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  City
                  <input
                    required
                    value={addrForm.city}
                    onChange={(e) => setAddrForm((f) => ({ ...f, city: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  State
                  <input
                    required
                    value={addrForm.state}
                    onChange={(e) => setAddrForm((f) => ({ ...f, state: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  ZIP
                  <input
                    required
                    value={addrForm.zip}
                    onChange={(e) => setAddrForm((f) => ({ ...f, zip: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Country
                  <input
                    required
                    value={addrForm.country}
                    onChange={(e) => setAddrForm((f) => ({ ...f, country: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={addrForm.isDefault}
                  onChange={(e) => setAddrForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                Set as default address
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddressModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addressSaving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {addressSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
