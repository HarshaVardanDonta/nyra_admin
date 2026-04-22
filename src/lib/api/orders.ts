import { fetchWithAuthRetry, request } from './client'
import { ApiError } from './errors'
import { pickUserPublicId } from './users'

const API = '/api/v1'

/** Used for PATCH status and refund when auth has no display name. */
export const ORDER_CHANGED_BY = 'Admin'

export type OrderListStatus = {
  id: number
  name: string
  indicator_color: string
}

export type OrderListUser = {
  id: string
  name: string
  initials: string
  avatar_color: string
}

export type OrderListRow = {
  id: number
  order_number: string
  items_count: number
  grand_total: number
  payment_status: string
  status: OrderListStatus
  date: string
  user: OrderListUser | null
}

export type OrdersListPagination = {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export type OrdersListParams = {
  search?: string
  page?: number
  per_page?: number
  status_id?: number
  payment_status?: string
  /** Numeric string only; backend list filter parses an int. */
  user_id?: string
  period?: '7d' | '30d' | '1y' | 'all'
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function pickNum(o: Record<string, unknown>, key: string): number | undefined {
  const v = o[key]
  if (typeof v === 'number' && Number.isFinite(v)) return v
  return undefined
}

function pickStr(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key]
  if (typeof v === 'string') return v
  return undefined
}

function pickBool(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key]
  if (typeof v === 'boolean') return v
  return undefined
}

function normalizeListRow(raw: unknown): OrderListRow | null {
  const o = asRecord(raw)
  if (!o) return null
  const id = pickNum(o, 'id')
  if (id === undefined) return null
  const st = asRecord(o.status)
  if (!st) return null
  const sid = pickNum(st, 'id')
  if (sid === undefined) return null
  let user: OrderListUser | null = null
  const ur = o.user ?? o.customer
  if (ur && typeof ur === 'object' && !Array.isArray(ur)) {
    const u = ur as Record<string, unknown>
    const uid = pickUserPublicId(u.id)
    if (uid) {
      user = {
        id: uid,
        name: pickStr(u, 'name') ?? '',
        initials: pickStr(u, 'initials') ?? '',
        avatar_color: pickStr(u, 'avatar_color') ?? '#3B82F6',
      }
    }
  }
  return {
    id,
    order_number: pickStr(o, 'order_number') ?? '',
    items_count: pickNum(o, 'items_count') ?? 0,
    grand_total: pickNum(o, 'grand_total') ?? 0,
    payment_status: pickStr(o, 'payment_status') ?? '',
    status: {
      id: sid,
      name: pickStr(st, 'name') ?? '',
      indicator_color: pickStr(st, 'indicator_color') ?? '',
    },
    date: pickStr(o, 'date') ?? '',
    user,
  }
}

export async function fetchOrders(
  token: string | null,
  params: OrdersListParams,
): Promise<{ data: OrderListRow[]; pagination: OrdersListPagination }> {
  const q = new URLSearchParams()
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.page != null && params.page > 0) q.set('page', String(params.page))
  if (params.per_page != null && params.per_page > 0) q.set('per_page', String(params.per_page))
  if (params.status_id != null && params.status_id > 0) q.set('status_id', String(params.status_id))
  if (params.payment_status?.trim()) q.set('payment_status', params.payment_status.trim())
  if (params.user_id?.trim()) q.set('user_id', params.user_id.trim())
  if (params.period) q.set('period', params.period)
  if (params.sort_by?.trim()) q.set('sort_by', params.sort_by.trim())
  if (params.sort_dir) q.set('sort_dir', params.sort_dir)

  const raw = await request<unknown>(`${API}/orders?${q}`, { method: 'GET', token })
  const root = asRecord(raw) ?? {}
  const dataRaw = root.data
  const data: OrderListRow[] = []
  if (Array.isArray(dataRaw)) {
    for (const row of dataRaw) {
      const it = normalizeListRow(row)
      if (it) data.push(it)
    }
  }
  const pag = asRecord(root.pagination) ?? {}
  return {
    data,
    pagination: {
      page: pickNum(pag, 'page') ?? 1,
      per_page: pickNum(pag, 'per_page') ?? 10,
      total: pickNum(pag, 'total') ?? 0,
      total_pages: pickNum(pag, 'total_pages') ?? 0,
    },
  }
}

export function buildOrdersExportQuery(params: Omit<OrdersListParams, 'page' | 'per_page'>): string {
  const q = new URLSearchParams()
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.status_id != null && params.status_id > 0) q.set('status_id', String(params.status_id))
  if (params.payment_status?.trim()) q.set('payment_status', params.payment_status.trim())
  if (params.user_id?.trim()) q.set('user_id', params.user_id.trim())
  if (params.period) q.set('period', params.period)
  if (params.sort_by?.trim()) q.set('sort_by', params.sort_by.trim())
  if (params.sort_dir) q.set('sort_dir', params.sort_dir)
  return q.toString()
}

export async function downloadOrdersExport(
  token: string | null,
  params: Omit<OrdersListParams, 'page' | 'per_page'>,
): Promise<void> {
  const qs = buildOrdersExportQuery(params)
  const path = `${API}/orders/export${qs ? `?${qs}` : ''}`
  let res: Response
  try {
    res = await fetchWithAuthRetry(path, {
      method: 'GET',
      headers: { Accept: 'text/csv, */*' },
      token,
    })
  } catch (e) {
    if (e instanceof ApiError) throw e
    const msg = e instanceof Error ? e.message : 'Could not reach the server'
    throw new ApiError(`Network error: ${msg}`, 0)
  }
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  let filename = 'orders-export.csv'
  const m = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)
  if (m?.[1]) {
    filename = decodeURIComponent(m[1].replace(/"/g, '').trim())
  }
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export type OrderAdminCurrentStatus = {
  id: number
  name: string
  indicator_color: string
}

export type OrderAdminHeader = {
  id: number
  order_number: string
  current_status: OrderAdminCurrentStatus
  last_updated_at: string
  payment_status: string
  created_at: string
  /** When true, customer receives SMS/email on status change / admin cancel (if backend is configured). */
  notify_customer_status_updates: boolean
}

export type OrderAdminAvailableStatus = { id: number; name: string }

export type OrderAdminLineItem = {
  id: number
  product_id: number
  product_name: string
  product_sku: string
  unit_price: number
  quantity: number
  subtotal: number
  product_thumbnail_url: string | null
  variant_label: string | null
}

export type OrderAdminTaxBreakdownRow = {
  /** GST bucket name (CGST, SGST, …); absent on legacy orders. */
  label?: string
  rate: number
  taxable_base: number
  tax_amount: number
}

export type OrderAdminSummary = {
  items_subtotal: number
  discount_amount: number
  shipping_amount: number
  tax_rate: number
  tax_amount: number
  tax_breakdown: OrderAdminTaxBreakdownRow[]
  grand_total: number
}

export type OrderAdminUser = {
  id: string
  name: string
  email: string
  phone: string
  initials: string
  avatar_color: string
}

export type OrderAdminShipping = {
  recipient_name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip: string
  country: string
}

export type OrderAdminPayment = {
  method: string | null
  transaction_id: string | null
  status: string
}

export type OrderAdminHistoryEntry = {
  id: number
  status_name: string
  changed_by: string
  note: string | null
  created_at: string
  relative_time: string
}

export type OrderAdminDetails = {
  order: OrderAdminHeader
  available_statuses: OrderAdminAvailableStatus[]
  items: OrderAdminLineItem[]
  order_summary: OrderAdminSummary
  user: OrderAdminUser | null
  shipping_address: OrderAdminShipping | null
  payment: OrderAdminPayment
  status_history: OrderAdminHistoryEntry[]
}

function parseAdminDetails(raw: unknown): OrderAdminDetails {
  const root = asRecord(raw) ?? {}
  const ord = asRecord(root.order) ?? {}
  const cs = asRecord(ord.current_status) ?? {}
  const summary = asRecord(root.order_summary) ?? {}
  const pay = asRecord(root.payment) ?? {}

  const avail: OrderAdminAvailableStatus[] = []
  const avRaw = root.available_statuses
  if (Array.isArray(avRaw)) {
    for (const x of avRaw) {
      const r = asRecord(x)
      if (!r) continue
      const id = pickNum(r, 'id')
      if (id === undefined) continue
      avail.push({ id, name: pickStr(r, 'name') ?? '' })
    }
  }

  const items: OrderAdminLineItem[] = []
  const itemsRaw = root.items
  if (Array.isArray(itemsRaw)) {
    for (const x of itemsRaw) {
      const r = asRecord(x)
      if (!r) continue
      const id = pickNum(r, 'id')
      if (id === undefined) continue
      items.push({
        id,
        product_id: pickNum(r, 'product_id') ?? 0,
        product_name: pickStr(r, 'product_name') ?? '',
        product_sku: pickStr(r, 'product_sku') ?? '',
        unit_price: pickNum(r, 'unit_price') ?? 0,
        quantity: pickNum(r, 'quantity') ?? 0,
        subtotal: pickNum(r, 'subtotal') ?? 0,
        product_thumbnail_url:
          typeof r.product_thumbnail_url === 'string' ? r.product_thumbnail_url : null,
        variant_label: typeof r.variant_label === 'string' ? r.variant_label : null,
      })
    }
  }

  const hist: OrderAdminHistoryEntry[] = []
  const hRaw = root.status_history
  if (Array.isArray(hRaw)) {
    for (const x of hRaw) {
      const r = asRecord(x)
      if (!r) continue
      const id = pickNum(r, 'id')
      if (id === undefined) continue
      hist.push({
        id,
        status_name: pickStr(r, 'status_name') ?? '',
        changed_by: pickStr(r, 'changed_by') ?? '',
        note: typeof r.note === 'string' ? r.note : null,
        created_at: pickStr(r, 'created_at') ?? '',
        relative_time: pickStr(r, 'relative_time') ?? '',
      })
    }
  }

  let user: OrderAdminUser | null = null
  const uRaw = root.user ?? root.customer
  if (uRaw && typeof uRaw === 'object' && !Array.isArray(uRaw)) {
    const u = uRaw as Record<string, unknown>
    const uid = pickUserPublicId(u.id)
    if (uid) {
      user = {
        id: uid,
        name: pickStr(u, 'name') ?? '',
        email: pickStr(u, 'email') ?? '',
        phone: pickStr(u, 'phone') ?? '',
        initials: pickStr(u, 'initials') ?? '',
        avatar_color: pickStr(u, 'avatar_color') ?? '#3B82F6',
      }
    }
  }

  let shipping_address: OrderAdminShipping | null = null
  const sRaw = root.shipping_address
  if (sRaw && typeof sRaw === 'object' && !Array.isArray(sRaw)) {
    const s = sRaw as Record<string, unknown>
    shipping_address = {
      recipient_name: pickStr(s, 'recipient_name') ?? '',
      address_line1: pickStr(s, 'address_line1') ?? '',
      address_line2: typeof s.address_line2 === 'string' ? s.address_line2 : null,
      city: pickStr(s, 'city') ?? '',
      state: pickStr(s, 'state') ?? '',
      zip: pickStr(s, 'zip') ?? '',
      country: pickStr(s, 'country') ?? '',
    }
  }

  function parseTaxBreakdown(raw: unknown): OrderAdminTaxBreakdownRow[] {
    if (!Array.isArray(raw)) return []
    const out: OrderAdminTaxBreakdownRow[] = []
    for (const x of raw) {
      const r = asRecord(x)
      if (!r) continue
      const rate = pickNum(r, 'rate')
      if (rate === undefined) continue
      out.push({
        label: pickStr(r, 'label'),
        rate,
        taxable_base: pickNum(r, 'taxable_base') ?? 0,
        tax_amount: pickNum(r, 'tax_amount') ?? 0,
      })
    }
    return out
  }

  return {
    order: {
      id: pickNum(ord, 'id') ?? 0,
      order_number: pickStr(ord, 'order_number') ?? '',
      current_status: {
        id: pickNum(cs, 'id') ?? 0,
        name: pickStr(cs, 'name') ?? '',
        indicator_color: pickStr(cs, 'indicator_color') ?? '',
      },
      last_updated_at: pickStr(ord, 'last_updated_at') ?? '',
      payment_status: pickStr(ord, 'payment_status') ?? '',
      created_at: pickStr(ord, 'created_at') ?? '',
      notify_customer_status_updates: pickBool(ord, 'notify_customer_status_updates') ?? true,
    },
    available_statuses: avail,
    items,
    order_summary: {
      items_subtotal: pickNum(summary, 'items_subtotal') ?? 0,
      discount_amount: pickNum(summary, 'discount_amount') ?? 0,
      shipping_amount: pickNum(summary, 'shipping_amount') ?? 0,
      tax_rate: pickNum(summary, 'tax_rate') ?? 0,
      tax_amount: pickNum(summary, 'tax_amount') ?? 0,
      tax_breakdown: parseTaxBreakdown(summary.tax_breakdown),
      grand_total: pickNum(summary, 'grand_total') ?? 0,
    },
    user,
    shipping_address,
    payment: {
      method: typeof pay.method === 'string' ? pay.method : null,
      transaction_id: typeof pay.transaction_id === 'string' ? pay.transaction_id : null,
      status: pickStr(pay, 'status') ?? '',
    },
    status_history: hist,
  }
}

export async function fetchOrderAdminDetails(
  token: string | null,
  orderId: number,
): Promise<OrderAdminDetails> {
  const raw = await request<unknown>(`${API}/orders/${orderId}/details`, { method: 'GET', token })
  return parseAdminDetails(raw)
}

/** Fields editable via PUT /orders/:id (full GET /orders/:id includes these on `order`). */
export type OrderEditableFields = {
  notes: string
  shipping_address_id: number | null
}

export async function fetchOrderEditableFields(
  token: string | null,
  orderId: number,
): Promise<OrderEditableFields> {
  const raw = await request<unknown>(`${API}/orders/${orderId}`, { method: 'GET', token })
  const root = asRecord(raw) ?? {}
  const ord = asRecord(root.order) ?? {}
  const notesRaw = ord.notes
  const notes = typeof notesRaw === 'string' ? notesRaw : ''
  let shipping_address_id: number | null = null
  const sid = ord.shipping_address_id
  if (typeof sid === 'number' && Number.isFinite(sid)) shipping_address_id = sid
  return { notes, shipping_address_id }
}

export async function patchOrderStatus(
  token: string | null,
  orderId: number,
  body: { status_id: number; changed_by: string; note?: string | null },
): Promise<void> {
  await request(`${API}/orders/${orderId}/status`, {
    method: 'PATCH',
    token,
    body: {
      status_id: body.status_id,
      changed_by: body.changed_by,
      note: body.note ?? null,
    },
  })
}

export async function cancelOrder(token: string | null, orderId: number): Promise<void> {
  await request(`${API}/orders/${orderId}/cancel`, { method: 'PATCH', token })
}

export async function refundOrder(
  token: string | null,
  orderId: number,
  body: { changed_by: string; note?: string | null },
): Promise<void> {
  await request(`${API}/orders/${orderId}/refund`, {
    method: 'PATCH',
    token,
    body: {
      changed_by: body.changed_by,
      note: body.note ?? null,
    },
  })
}

export async function updateOrder(
  token: string | null,
  orderId: number,
  body: {
    notes?: string | null
    shipping_address_id?: number | null
    notify_customer_status_updates?: boolean
  },
): Promise<void> {
  await request(`${API}/orders/${orderId}`, {
    method: 'PUT',
    token,
    body: {
      notes: body.notes,
      shipping_address_id: body.shipping_address_id,
      notify_customer_status_updates: body.notify_customer_status_updates,
    },
  })
}

export async function fetchOrderInvoiceJson(
  token: string | null,
  orderId: number,
): Promise<unknown> {
  return request<unknown>(`${API}/orders/${orderId}/invoice?format=json`, {
    method: 'GET',
    token,
  })
}

export async function fetchOrderInvoicePdf(
  token: string | null,
  orderId: number,
): Promise<Blob> {
  const res = await fetchWithAuthRetry(`${API}/orders/${orderId}/invoice`, { token })
  return res.blob()
}

export function downloadPdfBlob(filename: string, blob: Blob) {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}
