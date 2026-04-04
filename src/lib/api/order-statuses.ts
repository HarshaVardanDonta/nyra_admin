import { fetchWithAuthRetry, request } from './client'
import { ApiError } from './errors'

export type OrderStatusRecord = {
  id: number
  name: string
  indicator_color: string
  description: string | null
  is_visible: boolean
  is_system: boolean
  sort_order: number
  orders_count: number
}

export type OrderStatusAuditItem = {
  id: number
  status_id: number | null
  status_name: string | null
  action: string
  changed_by: string
  diff: Record<string, unknown>
  created_at: string
}

export type OrderStatusAuditResponse = {
  data: OrderStatusAuditItem[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

export type OrderStatusWriteInput = {
  name: string
  indicator_color: string
  description?: string | null
  is_visible?: boolean
}

export type OrderStatusReorderEntry = {
  id: number
  sort_order: number
}

export async function fetchOrderStatuses(token: string | null): Promise<OrderStatusRecord[]> {
  return request<OrderStatusRecord[]>('/api/v1/order-statuses', { method: 'GET', token })
}

export async function createOrderStatus(
  token: string | null,
  body: OrderStatusWriteInput,
): Promise<OrderStatusRecord> {
  return request<OrderStatusRecord>('/api/v1/order-statuses', {
    method: 'POST',
    token,
    body: {
      name: body.name,
      indicator_color: body.indicator_color,
      description: body.description ?? null,
      is_visible: body.is_visible,
    },
  })
}

export async function updateOrderStatus(
  token: string | null,
  id: number,
  body: OrderStatusWriteInput,
): Promise<OrderStatusRecord> {
  return request<OrderStatusRecord>(`/api/v1/order-statuses/${id}`, {
    method: 'PUT',
    token,
    body: {
      name: body.name,
      indicator_color: body.indicator_color,
      description: body.description ?? null,
      is_visible: body.is_visible,
    },
  })
}

export async function deleteOrderStatus(
  token: string | null,
  id: number,
  options?: { reassignOrdersToStatusId?: number },
): Promise<void> {
  const body =
    options?.reassignOrdersToStatusId != null
      ? { reassign_orders_to_status_id: options.reassignOrdersToStatusId }
      : undefined
  await request(`/api/v1/order-statuses/${id}`, { method: 'DELETE', token, body })
}

export async function reorderOrderStatuses(
  token: string | null,
  order: OrderStatusReorderEntry[],
): Promise<void> {
  await request('/api/v1/order-statuses/reorder', {
    method: 'PATCH',
    token,
    body: { order },
  })
}

export async function toggleOrderStatusVisibility(
  token: string | null,
  id: number,
): Promise<OrderStatusRecord> {
  return request<OrderStatusRecord>(`/api/v1/order-statuses/${id}/toggle-visibility`, {
    method: 'PATCH',
    token,
  })
}

export async function fetchOrderStatusAuditLog(
  token: string | null,
  page: number,
  perPage: number,
): Promise<OrderStatusAuditResponse> {
  const q = new URLSearchParams()
  q.set('page', String(page))
  q.set('per_page', String(perPage))
  return request<OrderStatusAuditResponse>(`/api/v1/order-statuses/audit-log?${q.toString()}`, {
    method: 'GET',
    token,
  })
}

/**
 * Downloads CSV from GET /order-statuses/export (not JSON).
 */
export async function downloadOrderStatusesExport(token: string | null): Promise<void> {
  const path = '/api/v1/order-statuses/export'

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
  let filename = 'order-statuses.csv'
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
