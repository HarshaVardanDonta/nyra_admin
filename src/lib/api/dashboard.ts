import { request } from './client'

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

export type RecentOrderCustomer = {
  id: number
  name: string
  initials: string
  avatarColor: string
}

export type RecentOrder = {
  orderId: string
  customer: RecentOrderCustomer
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

export async function fetchDashboardOverview(
  token: string | null,
  period: DashboardPeriod,
): Promise<DashboardOverview> {
  const q = new URLSearchParams({ period })
  return request<DashboardOverview>(
    `/api/v1/dashboard/overview?${q.toString()}`,
    { method: 'GET', token },
  )
}
