import { fetchWithAuthRetry, request } from './client'

const API = '/api/v1'

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string') return v
  }
  return undefined
}

function pickNum(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return undefined
}

function pickBool(o: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'boolean') return v
  }
  return undefined
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

export type CustomerListItem = {
  id: number
  name: string
  initials: string
  avatarColor: string
  avatarUrl: string | null
  phone: string
  email: string
  totalOrders: number
  totalSpent: number
  joinedDate: string
  status: string
}

export type CustomersPagination = {
  page: number
  perPage: number
  total: number
  totalPages: number
}

export type CustomersListParams = {
  search?: string
  page?: number
  perPage?: number
  orderCountGt?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

function normalizeListItem(raw: unknown): CustomerListItem | null {
  const o = asRecord(raw)
  if (!o) return null
  const id = pickNum(o, 'id')
  if (id === undefined) return null
  const name = pickStr(o, 'name') ?? ''
  return {
    id,
    name,
    initials: pickStr(o, 'initials') ?? '',
    avatarColor: pickStr(o, 'avatar_color') ?? '#3B82F6',
    avatarUrl: typeof o.avatar_url === 'string' ? o.avatar_url : null,
    phone: pickStr(o, 'phone') ?? '',
    email: pickStr(o, 'email') ?? '',
    totalOrders: pickNum(o, 'total_orders') ?? 0,
    totalSpent: pickNum(o, 'total_spent') ?? 0,
    joinedDate: pickStr(o, 'joined_date') ?? '',
    status: pickStr(o, 'status') ?? '',
  }
}

export async function fetchCustomersList(
  token: string | null,
  params: CustomersListParams,
): Promise<{ items: CustomerListItem[]; pagination: CustomersPagination }> {
  const q = new URLSearchParams()
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.page != null && params.page > 0) q.set('page', String(params.page))
  if (params.perPage != null && params.perPage > 0) q.set('per_page', String(params.perPage))
  if (params.orderCountGt != null) q.set('order_count_gt', String(params.orderCountGt))
  if (params.sortBy?.trim()) q.set('sort_by', params.sortBy.trim())
  if (params.sortDir) q.set('sort_dir', params.sortDir)
  const raw = await request<unknown>(`${API}/customers?${q}`, { method: 'GET', token })
  const root = asRecord(raw) ?? {}
  const data = root.data
  const items: CustomerListItem[] = []
  if (Array.isArray(data)) {
    for (const row of data) {
      const it = normalizeListItem(row)
      if (it) items.push(it)
    }
  }
  const pag = asRecord(root.pagination) ?? {}
  return {
    items,
    pagination: {
      page: pickNum(pag, 'page') ?? 1,
      perPage: pickNum(pag, 'per_page') ?? 10,
      total: pickNum(pag, 'total') ?? items.length,
      totalPages: pickNum(pag, 'total_pages') ?? 0,
    },
  }
}

function parseFilenameFromDisposition(cd: string | null): string | null {
  if (!cd) return null
  const m = /filename\*?=(?:UTF-8'')?["']?([^"'\n;]+)/i.exec(cd)
  return m?.[1]?.replace(/^["']|["']$/g, '') ?? null
}

/** Triggers browser download of CSV from GET /customers/export */
export async function downloadCustomersExport(
  token: string | null,
  params: Omit<CustomersListParams, 'page' | 'perPage'>,
): Promise<void> {
  const q = new URLSearchParams()
  if (params.search?.trim()) q.set('search', params.search.trim())
  if (params.orderCountGt != null) q.set('order_count_gt', String(params.orderCountGt))
  if (params.sortBy?.trim()) q.set('sort_by', params.sortBy.trim())
  if (params.sortDir) q.set('sort_dir', params.sortDir)
  const res = await fetchWithAuthRetry(`${API}/customers/export?${q}`, { method: 'GET', token })
  const blob = await res.blob()
  const name =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) ?? 'customers-export.csv'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type CustomerProfileDetail = {
  id: number
  name: string
  initials: string
  avatarColor: string
  avatarUrl: string | null
  email: string
  phone: string
  status: string
  membershipTier: string
  membershipSince: number | null
  source: string
  joinedDate: string
}

export type CustomerDetailKPIs = {
  totalOrders: {
    value: number
    changePercent: number
    trend: string
    vsLabel: string
  }
  totalSpent: {
    value: number
    changePercent: number
    trend: string
  }
  avgOrderValue: {
    value: number
    trendLabel: string
  }
  lastOrder: {
    relativeLabel: string
    date: string | null
  }
}

export type CustomerDetailAddress = {
  id: number
  label: string
  tag: string
  isDefault: boolean
  fullAddress: string
}

export type CustomerDetailView = {
  profile: CustomerProfileDetail
  kpis: CustomerDetailKPIs
  addresses: CustomerDetailAddress[]
}

function normalizeDetailProfile(o: Record<string, unknown>): CustomerProfileDetail {
  return {
    id: pickNum(o, 'id') ?? 0,
    name: pickStr(o, 'name') ?? '',
    initials: pickStr(o, 'initials') ?? '',
    avatarColor: pickStr(o, 'avatar_color') ?? '#3B82F6',
    avatarUrl: typeof o.avatar_url === 'string' ? o.avatar_url : null,
    email: pickStr(o, 'email') ?? '',
    phone: pickStr(o, 'phone') ?? '',
    status: pickStr(o, 'status') ?? '',
    membershipTier: pickStr(o, 'membership_tier') ?? '',
    membershipSince:
      typeof o.membership_since === 'number' && Number.isFinite(o.membership_since)
        ? o.membership_since
        : null,
    source: pickStr(o, 'source') ?? '',
    joinedDate: pickStr(o, 'joined_date') ?? '',
  }
}

function normalizeKPIsBlock(raw: unknown): CustomerDetailKPIs {
  const o = asRecord(raw) ?? {}
  const to = asRecord(o.total_orders) ?? {}
  const ts = asRecord(o.total_spent) ?? {}
  const av = asRecord(o.avg_order_value) ?? {}
  const lo = asRecord(o.last_order) ?? {}
  return {
    totalOrders: {
      value: pickNum(to, 'value') ?? 0,
      changePercent: pickNum(to, 'change_percent') ?? 0,
      trend: pickStr(to, 'trend') ?? '',
      vsLabel: pickStr(to, 'vs_label') ?? '',
    },
    totalSpent: {
      value: pickNum(ts, 'value') ?? 0,
      changePercent: pickNum(ts, 'change_percent') ?? 0,
      trend: pickStr(ts, 'trend') ?? '',
    },
    avgOrderValue: {
      value: pickNum(av, 'value') ?? 0,
      trendLabel: pickStr(av, 'trend_label') ?? '',
    },
    lastOrder: {
      relativeLabel: pickStr(lo, 'relative_label') ?? '',
      date: typeof lo.date === 'string' ? lo.date : null,
    },
  }
}

function normalizeDetailAddress(raw: unknown): CustomerDetailAddress | null {
  const o = asRecord(raw)
  if (!o) return null
  const id = pickNum(o, 'id')
  if (id === undefined) return null
  return {
    id,
    label: pickStr(o, 'label') ?? '',
    tag: pickStr(o, 'tag') ?? '',
    isDefault: pickBool(o, 'is_default') === true,
    fullAddress: pickStr(o, 'full_address') ?? '',
  }
}

export async function fetchCustomerDetails(
  token: string | null,
  customerId: number,
): Promise<CustomerDetailView> {
  const raw = await request<unknown>(`${API}/customers/${customerId}/details`, {
    method: 'GET',
    token,
  })
  const root = asRecord(raw) ?? {}
  const prof = asRecord(root.profile) ?? {}
  const addrsRaw = root.addresses
  const addresses: CustomerDetailAddress[] = []
  if (Array.isArray(addrsRaw)) {
    for (const a of addrsRaw) {
      const row = normalizeDetailAddress(a)
      if (row) addresses.push(row)
    }
  }
  return {
    profile: normalizeDetailProfile(prof),
    kpis: normalizeKPIsBlock(root.kpis),
    addresses,
  }
}

export type CustomerOrderRow = {
  orderId: string
  date: string
  itemsCount: number
  total: number
  paymentStatus: string
  fulfillmentStatus: string
}

function normalizeOrderRow(raw: unknown): CustomerOrderRow | null {
  const o = asRecord(raw)
  if (!o) return null
  const orderId = pickStr(o, 'order_id')
  if (!orderId) return null
  return {
    orderId,
    date: pickStr(o, 'date') ?? '',
    itemsCount: pickNum(o, 'items_count') ?? 0,
    total: pickNum(o, 'total') ?? 0,
    paymentStatus: pickStr(o, 'payment_status') ?? '',
    fulfillmentStatus: pickStr(o, 'fulfillment_status') ?? '',
  }
}

export type CustomerOrdersParams = {
  page?: number
  perPage?: number
  status?: string
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

export async function fetchCustomerOrders(
  token: string | null,
  customerId: number,
  params: CustomerOrdersParams = {},
): Promise<{ items: CustomerOrderRow[]; pagination: CustomersPagination }> {
  const q = new URLSearchParams()
  if (params.page != null && params.page > 0) q.set('page', String(params.page))
  if (params.perPage != null && params.perPage > 0) q.set('per_page', String(params.perPage))
  if (params.status?.trim()) q.set('status', params.status.trim())
  if (params.sortBy?.trim()) q.set('sort_by', params.sortBy.trim())
  if (params.sortDir) q.set('sort_dir', params.sortDir)
  const raw = await request<unknown>(`${API}/customers/${customerId}/orders?${q}`, {
    method: 'GET',
    token,
  })
  const root = asRecord(raw) ?? {}
  const data = root.data
  const items: CustomerOrderRow[] = []
  if (Array.isArray(data)) {
    for (const row of data) {
      const it = normalizeOrderRow(row)
      if (it) items.push(it)
    }
  }
  const pag = asRecord(root.pagination) ?? {}
  return {
    items,
    pagination: {
      page: pickNum(pag, 'page') ?? 1,
      perPage: pickNum(pag, 'per_page') ?? 10,
      total: pickNum(pag, 'total') ?? items.length,
      totalPages: pickNum(pag, 'total_pages') ?? 0,
    },
  }
}

export async function downloadCustomerOrdersExport(
  token: string | null,
  customerId: number,
  params: Pick<CustomerOrdersParams, 'status' | 'sortBy' | 'sortDir'> = {},
): Promise<void> {
  const q = new URLSearchParams()
  if (params.status?.trim()) q.set('status', params.status.trim())
  if (params.sortBy?.trim()) q.set('sort_by', params.sortBy.trim())
  if (params.sortDir) q.set('sort_dir', params.sortDir)
  const res = await fetchWithAuthRetry(
    `${API}/customers/${customerId}/orders/export?${q}`,
    { method: 'GET', token },
  )
  const blob = await res.blob()
  const name =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) ??
    `customer-${customerId}-orders.csv`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type CustomerActivityItem = {
  id: number
  eventType: string
  description: string
  relativeTime: string
  absoluteTime: string
  createdAt: string
}

function normalizeActivityItem(raw: unknown): CustomerActivityItem | null {
  const o = asRecord(raw)
  if (!o) return null
  const id = pickNum(o, 'id')
  if (id === undefined) return null
  return {
    id,
    eventType: pickStr(o, 'event_type') ?? '',
    description: pickStr(o, 'description') ?? '',
    relativeTime: pickStr(o, 'relative_time') ?? '',
    absoluteTime: pickStr(o, 'absolute_time') ?? '',
    createdAt: pickStr(o, 'created_at') ?? '',
  }
}

export async function fetchCustomerActivity(
  token: string | null,
  customerId: number,
  page = 1,
  perPage = 20,
): Promise<{ items: CustomerActivityItem[]; pagination: CustomersPagination }> {
  const q = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  const raw = await request<unknown>(`${API}/customers/${customerId}/activity?${q}`, {
    method: 'GET',
    token,
  })
  const root = asRecord(raw) ?? {}
  const data = root.data
  const items: CustomerActivityItem[] = []
  if (Array.isArray(data)) {
    for (const row of data) {
      const it = normalizeActivityItem(row)
      if (it) items.push(it)
    }
  }
  const pag = asRecord(root.pagination) ?? {}
  return {
    items,
    pagination: {
      page: pickNum(pag, 'page') ?? 1,
      perPage: pickNum(pag, 'per_page') ?? perPage,
      total: pickNum(pag, 'total') ?? items.length,
      totalPages: pickNum(pag, 'total_pages') ?? 0,
    },
  }
}

export type CustomerRecord = {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string
  status: string
  membershipTier: string
  membershipSince: number | null
  source: string
  createdAt: string
  updatedAt: string
}

function normalizeCustomerRecord(raw: unknown): CustomerRecord | null {
  const o = asRecord(raw)
  if (!o) return null
  const id = pickNum(o, 'id')
  if (id === undefined) return null
  return {
    id,
    firstName: pickStr(o, 'firstName', 'first_name') ?? '',
    lastName: pickStr(o, 'lastName', 'last_name') ?? '',
    email: pickStr(o, 'email') ?? '',
    phone: pickStr(o, 'phone') ?? '',
    avatarUrl: pickStr(o, 'avatarUrl', 'avatar_url') ?? '',
    status: pickStr(o, 'status') ?? '',
    membershipTier: pickStr(o, 'membershipTier', 'membership_tier') ?? '',
    membershipSince:
      typeof o.membershipSince === 'number'
        ? o.membershipSince
        : typeof o.membership_since === 'number'
          ? o.membership_since
          : null,
    source: pickStr(o, 'source') ?? '',
    createdAt: pickStr(o, 'createdAt', 'created_at') ?? '',
    updatedAt: pickStr(o, 'updatedAt', 'updated_at') ?? '',
  }
}

export async function fetchCustomer(token: string | null, customerId: number): Promise<CustomerRecord> {
  const raw = await request<unknown>(`${API}/customers/${customerId}`, { method: 'GET', token })
  const row = normalizeCustomerRecord(raw)
  if (!row) throw new Error('Invalid customer response')
  return row
}

export type CustomerWriteBody = {
  firstName: string
  lastName: string
  email: string
  phone: string
  avatarUrl: string
  status: string
  membershipTier: string
  membershipSince: number | null
  source: string
}

export async function createCustomer(
  token: string,
  body: CustomerWriteBody,
): Promise<CustomerRecord> {
  const raw = await request<unknown>(`${API}/customers`, {
    method: 'POST',
    token,
    body: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      status: body.status,
      membershipTier: body.membershipTier,
      membershipSince: body.membershipSince ?? undefined,
      source: body.source,
    },
  })
  const row = normalizeCustomerRecord(raw)
  if (!row) throw new Error('Invalid create customer response')
  return row
}

export async function updateCustomer(
  token: string,
  customerId: number,
  body: CustomerWriteBody,
): Promise<CustomerRecord> {
  const raw = await request<unknown>(`${API}/customers/${customerId}`, {
    method: 'PUT',
    token,
    body: {
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      avatarUrl: body.avatarUrl,
      status: body.status,
      membershipTier: body.membershipTier,
      membershipSince: body.membershipSince ?? undefined,
      source: body.source,
    },
  })
  const row = normalizeCustomerRecord(raw)
  if (!row) throw new Error('Invalid update customer response')
  return row
}

export async function deleteCustomer(token: string, customerId: number): Promise<void> {
  await request<undefined>(`${API}/customers/${customerId}`, { method: 'DELETE', token })
}

export type AddressCreateBody = {
  label: string
  tag: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  country: string
  isDefault: boolean
}

export async function createCustomerAddress(
  token: string,
  customerId: number,
  body: AddressCreateBody,
): Promise<void> {
  await request(`${API}/customers/${customerId}/addresses`, {
    method: 'POST',
    token,
    body: {
      label: body.label,
      tag: body.tag,
      address_line1: body.addressLine1,
      address_line2: body.addressLine2.trim() ? body.addressLine2 : null,
      city: body.city,
      state: body.state,
      zip: body.zip,
      country: body.country,
      is_default: body.isDefault,
    },
  })
}

export async function deleteCustomerAddress(
  token: string,
  customerId: number,
  addressId: number,
): Promise<void> {
  await request<undefined>(`${API}/customers/${customerId}/addresses/${addressId}`, {
    method: 'DELETE',
    token,
  })
}

export async function setDefaultCustomerAddress(
  token: string,
  customerId: number,
  addressId: number,
): Promise<void> {
  await request<undefined>(
    `${API}/customers/${customerId}/addresses/${addressId}/set-default`,
    { method: 'PATCH', token },
  )
}
