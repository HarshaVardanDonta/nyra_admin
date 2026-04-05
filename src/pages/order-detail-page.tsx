import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  ORDER_CHANGED_BY,
  cancelOrder,
  downloadJsonFile,
  fetchOrderAdminDetails,
  fetchOrderEditableFields,
  fetchOrderInvoiceJson,
  patchOrderStatus,
  refundOrder,
  updateOrder,
  type OrderAdminDetails,
} from '../lib/api/orders'
import { fetchCustomerDetails, type CustomerDetailAddress } from '../lib/api/customers'
import { resolveMediaUrl } from '../lib/media-url'

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n)
}

function formatInt(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function indicatorBadgeClass(color: string): string {
  const c = color.trim().toLowerCase()
  const map: Record<string, string> = {
    yellow: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
    green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    emerald: 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    red: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    gray: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
    grey: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  }
  if (c.startsWith('#')) {
    return 'border-slate-500/30 bg-slate-500/10 text-slate-800 dark:text-slate-200'
  }
  return map[c] ?? 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30'
}

function paymentBadgeClass(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === 'paid') return 'bg-emerald-500/20 text-emerald-200'
  if (s === 'unpaid') return 'bg-amber-500/20 text-amber-200'
  if (s === 'refunded' || s === 'partially_refunded') return 'bg-red-500/20 text-red-200'
  return 'bg-slate-500/20 text-slate-200'
}

function mapsHref(sa: NonNullable<OrderAdminDetails['shipping_address']>): string {
  const q = [sa.address_line1, sa.city, sa.state, sa.zip, sa.country].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function OrderDetailPage() {
  const { orderId: orderIdParam } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const editMode = searchParams.get('edit') === '1'
  const { token } = useAuth()
  const { showToast, showApiError } = useToast()

  const notesSectionRef = useRef<HTMLDivElement>(null)
  const orderId = Number.parseInt(orderIdParam ?? '', 10)

  const [detail, setDetail] = useState<OrderAdminDetails | null>(null)
  const [notes, setNotes] = useState('')
  const [shippingAddressId, setShippingAddressId] = useState<string>('')
  const [addresses, setAddresses] = useState<CustomerDetailAddress[]>([])
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [statusNote, setStatusNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingStatus, setSavingStatus] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundNote, setRefundNote] = useState('')
  const [refundBusy, setRefundBusy] = useState(false)

  const loadAll = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) return
    setLoading(true)
    try {
      const [admin, editable] = await Promise.all([
        fetchOrderAdminDetails(token, orderId),
        fetchOrderEditableFields(token, orderId),
      ])
      setDetail(admin)
      setNotes(editable.notes)
      setShippingAddressId(
        editable.shipping_address_id != null && editable.shipping_address_id > 0
          ? String(editable.shipping_address_id)
          : '',
      )
      setSelectedStatusId(String(admin.order.current_status.id))
      setStatusNote('')
    } catch (e) {
      showApiError(e)
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }, [token, orderId, showApiError])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const customerId = detail?.customer?.id

  useEffect(() => {
    if (!customerId || !token) {
      setAddresses([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const d = await fetchCustomerDetails(token, customerId)
        if (!cancelled) setAddresses(d.addresses)
      } catch {
        if (!cancelled) setAddresses([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, token])

  useEffect(() => {
    if (!editMode || loading || !detail) return
    const t = window.setTimeout(() => {
      notesSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [editMode, loading, detail])

  const itemsCount = detail?.items.length ?? 0
  const taxPercentLabel = useMemo(() => {
    const r = detail?.order_summary.tax_rate ?? 0
    if (r <= 0) return '0%'
    const pct = r <= 1 ? r * 100 : r
    const rounded = Number.isInteger(pct) ? String(pct) : pct.toFixed(1).replace(/\.0$/, '')
    return `${rounded}%`
  }, [detail?.order_summary.tax_rate])

  async function handleSaveStatus() {
    if (!detail) return
    const sid = Number.parseInt(selectedStatusId, 10)
    if (!Number.isFinite(sid) || sid <= 0) {
      showToast('Pick a valid status.', 'error')
      return
    }
    setSavingStatus(true)
    try {
      await patchOrderStatus(token, orderId, {
        status_id: sid,
        changed_by: ORDER_CHANGED_BY,
        note: statusNote.trim() === '' ? null : statusNote.trim(),
      })
      showToast('Status updated.', 'success')
      await loadAll()
    } catch (e) {
      showApiError(e)
    } finally {
      setSavingStatus(false)
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      const sid =
        shippingAddressId === '' ? null : Number.parseInt(shippingAddressId, 10)
      await updateOrder(token, orderId, {
        notes: notes.trim() === '' ? null : notes.trim(),
        shipping_address_id:
          sid != null && Number.isFinite(sid) && sid > 0 ? sid : null,
      })
      showToast('Order updated.', 'success')
      await loadAll()
    } catch (e) {
      showApiError(e)
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancel this order? This may not be reversible.')) return
    setCancelBusy(true)
    try {
      await cancelOrder(token, orderId)
      showToast('Order cancelled.', 'success')
      await loadAll()
    } catch (e) {
      showApiError(e)
    } finally {
      setCancelBusy(false)
    }
  }

  async function handleRefundConfirm() {
    setRefundBusy(true)
    try {
      await refundOrder(token, orderId, {
        changed_by: ORDER_CHANGED_BY,
        note: refundNote.trim() === '' ? null : refundNote.trim(),
      })
      showToast('Refund recorded.', 'success')
      setRefundOpen(false)
      setRefundNote('')
      await loadAll()
    } catch (e) {
      showApiError(e)
    } finally {
      setRefundBusy(false)
    }
  }

  async function handleInvoice() {
    if (!detail) return
    try {
      const data = await fetchOrderInvoiceJson(token, orderId)
      const safe = detail.order.order_number.replace(/[^\w-]+/g, '_') || String(orderId)
      downloadJsonFile(`invoice-${safe}.json`, data)
      showToast('Invoice data downloaded.', 'success')
    } catch (e) {
      showApiError(e)
    }
  }

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return (
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:p-10">
        <p className="text-slate-600 dark:text-slate-400">Invalid order.</p>
        <Link to="/orders" className="mt-2 inline-block text-blue-600 dark:text-blue-400">
          Back to orders
        </Link>
      </div>
    )
  }

  if (loading && !detail) {
    return (
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:p-10">
        <p className="text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="min-w-0 px-4 py-6 sm:px-6 lg:p-10">
        <p className="text-slate-600 dark:text-slate-400">Order not found.</p>
        <Link to="/orders" className="mt-2 inline-block text-blue-600 dark:text-blue-400">
          Back to orders
        </Link>
      </div>
    )
  }

  const { order, order_summary: sum, customer, shipping_address: ship, payment, items, status_history } =
    detail

  return (
    <div className="min-w-0 px-4 pt-6 pb-28 text-slate-900 dark:text-slate-50 sm:px-6 lg:p-10">
      <nav className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        <Link to="/dashboard" className="hover:text-slate-800 dark:hover:text-slate-200">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <Link to="/orders" className="hover:text-slate-800 dark:hover:text-slate-200">
          Orders
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-800 dark:text-slate-200">Order #{order.order_number}</span>
      </nav>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Order #{order.order_number}</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleInvoice()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
              />
            </svg>
            Invoice
          </button>
          <button
            type="button"
            disabled={cancelBusy}
            onClick={() => void handleCancel()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {cancelBusy ? 'Cancelling…' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => setRefundOpen(true)}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 dark:border-slate-600 dark:text-slate-100"
          >
            Refund
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${indicatorBadgeClass(order.current_status.indicator_color)}`}
            >
              {order.current_status.name}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Last update: {formatDateTime(order.last_updated_at)}
          </p>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Change order status
          </label>
          <select
            value={selectedStatusId}
            onChange={(e) => setSelectedStatusId(e.target.value)}
            className="select-tail mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            {detail.available_statuses.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          <label className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">Note (optional)</label>
          <textarea
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            placeholder="e.g. handed to carrier…"
          />
          <button
            type="button"
            disabled={savingStatus}
            onClick={() => void handleSaveStatus()}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {savingStatus ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Order summary</h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>
                Items ({formatInt(itemsCount)})
              </span>
              <span className="tabular-nums">{formatMoney(sum.items_subtotal)}</span>
            </li>
            <li className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Shipping</span>
              <span className="tabular-nums">{formatMoney(sum.shipping_amount)}</span>
            </li>
            <li className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Tax ({taxPercentLabel})</span>
              <span className="tabular-nums">{formatMoney(sum.tax_amount)}</span>
            </li>
          </ul>
          <p className="mt-4 border-t border-slate-200 pt-4 text-lg font-semibold text-blue-600 dark:text-blue-400 dark:border-slate-700">
            {formatMoney(sum.grand_total)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold">Products ordered</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Price</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {it.product_thumbnail_url ? (
                          <img
                            src={resolveMediaUrl(it.product_thumbnail_url)}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400 dark:bg-slate-800">
                            —
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-slate-900 dark:text-slate-50">{it.product_name}</p>
                          {it.variant_label ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{it.variant_label}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{it.product_sku}</td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(it.unit_price)}</td>
                    <td className="px-4 py-3 tabular-nums">{it.quantity}</td>
                    <td className="px-4 py-3 tabular-nums font-medium">{formatMoney(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
            <h2 className="text-sm font-semibold">Customer info</h2>
          </div>
          {customer ? (
            <div className="mt-4 space-y-3 text-sm">
              <p className="text-lg font-semibold">{customer.name}</p>
              <p className="text-slate-500 dark:text-slate-400">Customer ID: {customer.customer_number}</p>
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
                <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline dark:text-blue-400">
                  {customer.email}
                </a>
              </div>
              {customer.phone ? (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                    />
                  </svg>
                  <span>{customer.phone}</span>
                </div>
              ) : null}
              <Link
                to={`/customers/${customer.id}`}
                className="inline-block text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                View customer profile
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No customer on file.</p>
          )}
        </div>
      </div>

      <div ref={notesSectionRef} className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125v-9.75m0 0c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v3.75m0 0h3.375m0 0h3.375m-3.375 0v-3.75m0 3.75h-3.375m0 0H9.75m-3 0v3.75m0-3.75H3.375m6.375 0v3.75m0-3.75h3.375m0 0h3.375"
              />
            </svg>
            <h2 className="text-sm font-semibold">Shipping address</h2>
          </div>
          {ship ? (
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              <p className="font-medium text-slate-900 dark:text-slate-50">{ship.recipient_name}</p>
              <p className="mt-1">{ship.address_line1}</p>
              {ship.address_line2 ? <p>{ship.address_line2}</p> : null}
              <p>
                {ship.city}, {ship.state} {ship.zip}
              </p>
              <p>{ship.country}</p>
              <a
                href={mapsHref(ship)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                View on map
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No shipping address.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
              />
            </svg>
            <h2 className="text-sm font-semibold">Payment details</h2>
          </div>
          <div className="mt-4 text-sm">
            <p className="font-medium text-slate-900 dark:text-slate-50">
              {payment.method?.trim() ? payment.method : '—'}
            </p>
            {payment.transaction_id ? (
              <p className="mt-1 text-slate-500 dark:text-slate-400">TXN: {payment.transaction_id}</p>
            ) : null}
            <div
              className={`mt-4 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium ${paymentBadgeClass(payment.status)}`}
            >
              <span>Status</span>
              <span className="capitalize">{payment.status.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827] lg:col-span-1">
          <h2 className="text-sm font-semibold">Status history</h2>
          <ul className="mt-4 space-y-0 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
            {status_history.length === 0 ? (
              <li className="text-sm text-slate-500 dark:text-slate-400">No history yet.</li>
            ) : (
              status_history.map((h) => (
                <li key={h.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[calc(0.5rem+2px)] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">{h.status_name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDateTime(h.created_at)}
                    {h.relative_time ? ` · ${h.relative_time}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Status updated by {h.changed_by}
                    {h.note ? `. ${h.note}` : ''}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111827]">
        <h2 className="text-sm font-semibold">Notes and shipping</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Internal notes and shipping address (when the order has a customer).
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full max-w-2xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        {customer && addresses.length > 0 ? (
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Shipping address
          </label>
        ) : null}
        {customer && addresses.length > 0 ? (
          <select
            value={shippingAddressId}
            onChange={(e) => setShippingAddressId(e.target.value)}
            className="select-tail mt-1 w-full max-w-2xl rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="">None</option>
            {addresses.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.label ? `${a.label} — ` : ''}
                {a.fullAddress}
              </option>
            ))}
          </select>
        ) : customer ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No saved addresses for this customer.</p>
        ) : null}
        <button
          type="button"
          disabled={savingNotes}
          onClick={() => void handleSaveNotes()}
          className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          {savingNotes ? 'Saving…' : 'Save notes & address'}
        </button>
      </div>

      {refundOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Close"
            onClick={() => !refundBusy && setRefundOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
            <h2 className="text-lg font-semibold">Refund order</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Add an optional note for the audit trail.
            </p>
            <textarea
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
              rows={3}
              className="mt-4 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={refundBusy}
                onClick={() => setRefundOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={refundBusy}
                onClick={() => void handleRefundConfirm()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {refundBusy ? 'Processing…' : 'Confirm refund'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
