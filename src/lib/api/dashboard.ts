import { request } from './client'
import { pickUserPublicId } from './users'

export type DashboardPeriod = 'weekly' | 'monthly'

export type KpiTrend = 'up' | 'down'

export type KpiCard = {
  value: number
  changePercent: number
  trend: KpiTrend
}

export type KpiBlock = {
  totalSales: KpiCard
  ordersToday: KpiCard
  totalCustomers: KpiCard
  revenueThisMonth: KpiCard
}

export type GraphPoint = {
  label: string
  value: number
}

export type SalesGraph = {
  period: DashboardPeriod
  data: GraphPoint[]
}

export type TopSellingProduct = {
  id: number
  name: string
  thumbnailUrl: string
  totalSalesCount: number
  totalRevenue: number
}

export type RecentOrderUser = {
  id: string
  name: string
  initials: string
  avatarColor: string
}

export type RecentOrder = {
  orderId: string
  user: RecentOrderUser
  itemsCount: number
  total: number
  status: string
  /** ISO date from API */
  date: string
}

export type DashboardOverview = {
  kpis: KpiBlock
  salesGraph: SalesGraph
  topSellingProducts: TopSellingProduct[]
  recentOrders: RecentOrder[]
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function normalizeRecentOrderUser(raw: unknown): RecentOrderUser | null {
  const o = asRecord(raw)
  if (!o) return null
  const id = pickUserPublicId(o.id)
  if (!id) return null
  return {
    id,
    name: typeof o.name === 'string' ? o.name : '',
    initials: typeof o.initials === 'string' ? o.initials : '',
    avatarColor:
      typeof o.avatarColor === 'string'
        ? o.avatarColor
        : typeof o.avatar_color === 'string'
          ? o.avatar_color
          : '#3B82F6',
  }
}

function normalizeRecentOrder(raw: unknown): RecentOrder | null {
  const o = asRecord(raw)
  if (!o) return null
  const orderId = o.orderId
  if (typeof orderId !== 'string') return null
  const userRaw = o.user ?? o.customer
  const user = userRaw ? normalizeRecentOrderUser(userRaw) : null
  if (!user) return null
  const itemsCount = o.itemsCount
  const total = o.total
  const status = o.status
  const date = o.date
  if (typeof itemsCount !== 'number' || typeof total !== 'number') return null
  if (typeof status !== 'string') return null
  const dateStr =
    typeof date === 'string'
      ? date
      : date instanceof Date
        ? date.toISOString()
        : typeof date === 'number'
          ? new Date(date).toISOString()
          : ''
  if (!dateStr) return null
  return {
    orderId,
    user,
    itemsCount,
    total,
    status,
    date: dateStr,
  }
}

function normalizeOverview(raw: unknown): DashboardOverview {
  const base = raw as DashboardOverview
  const root = asRecord(raw) ?? {}
  const recentRaw = root.recentOrders
  const recentOrders: RecentOrder[] = []
  if (Array.isArray(recentRaw)) {
    for (const row of recentRaw) {
      const ro = normalizeRecentOrder(row)
      if (ro) recentOrders.push(ro)
    }
  }
  return {
    ...base,
    recentOrders,
  }
}

export async function fetchDashboardOverview(
  token: string | null,
  period: DashboardPeriod,
): Promise<DashboardOverview> {
  const q = new URLSearchParams({ period })
  const raw = await request<unknown>(
    `/api/v1/dashboard/overview?${q.toString()}`,
    { method: 'GET', token },
  )
  return normalizeOverview(raw)
}
