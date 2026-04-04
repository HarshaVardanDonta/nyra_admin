import { fetchWithAuthRetry, request } from './client'

export type AnalyticsPeriod = '7d' | '30d' | '1y'

export type Trend = 'up' | 'down'

export type KpiFloat = {
  value: number
  change_percent: number
  trend: Trend
}

export type KpiInt = {
  value: number
  change_percent: number
  trend: Trend
}

export type AnalyticsKpis = {
  total_revenue: KpiFloat
  total_orders: KpiInt
  avg_order_value: KpiFloat
  conversion_rate: KpiFloat
}

export type RevenueGrowthPoint = {
  label: string
  current: number
  previous: number
}

export type RevenueGrowthBlock = {
  label: string
  data: RevenueGrowthPoint[]
}

export type DailyOrdersPoint = {
  label: string
  value: number
}

export type DailyOrdersBlock = {
  label: string
  data: DailyOrdersPoint[]
}

export type TopProduct = {
  id: number
  name: string
  thumbnail_url: string
  sales_count: number
  revenue: number
}

export type TopCategory = {
  id: number
  name: string
  order_count: number
  revenue_share_percent: number
}

export type TopCustomer = {
  id: number
  name: string
  initials: string
  avatar_color: string
  order_count: number
  total_spent: number
}

export type CustomerGrowthPoint = {
  label: string
  new_customers: number
}

export type CustomerGrowthBlock = {
  label: string
  data: CustomerGrowthPoint[]
}

export type AnalyticsResponse = {
  period: AnalyticsPeriod
  generated_at: string
  kpis: AnalyticsKpis
  revenue_growth: RevenueGrowthBlock
  daily_orders: DailyOrdersBlock
  top_products: TopProduct[]
  top_categories: TopCategory[]
  top_customers: TopCustomer[]
  customer_growth: CustomerGrowthBlock
}

export async function fetchAnalytics(
  token: string | null,
  period: AnalyticsPeriod,
): Promise<AnalyticsResponse> {
  const q = new URLSearchParams({ period })
  return request<AnalyticsResponse>(`/api/v1/analytics?${q.toString()}`, {
    method: 'GET',
    token,
  })
}

function parseFilenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const m = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(header)
  if (!m) return null
  return decodeURIComponent(m[1].replace(/"/g, '').trim())
}

export async function downloadAnalyticsExport(
  token: string,
  period: AnalyticsPeriod,
): Promise<void> {
  const path = `/api/v1/analytics/export?period=${encodeURIComponent(period)}`

  const res = await fetchWithAuthRetry(path, {
    method: 'GET',
    headers: { Accept: 'text/csv, */*' },
    token,
  })

  const blob = await res.blob()
  const fromHeader =
    parseFilenameFromDisposition(res.headers.get('Content-Disposition')) ??
    `analytics-${period}.csv`
  const filename = fromHeader.replace(/^["']|["']$/g, '')

  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename || `analytics-${period}.csv`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}
