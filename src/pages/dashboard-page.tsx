import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  type DashboardOverview,
  type DashboardPeriod,
  type GraphPoint,
  type KpiCard,
  type RecentOrder,
  fetchDashboardOverview,
} from '../lib/api/dashboard'
import { resolveMediaUrl } from '../lib/media-url'

function formatInr(n: number, opts?: { maximumFractionDigits?: number }) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: opts?.maximumFractionDigits ?? 0,
  }).format(n)
}

function formatPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function statusBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
    case 'confirmed':
      return 'border border-blue-500/35 bg-blue-500/15 text-blue-700 dark:text-blue-300'
    case 'pending':
      return 'border border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-200'
    case 'shipped':
      return 'border border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'cancelled':
      return 'border border-red-500/35 bg-red-500/15 text-red-700 dark:text-red-300'
    default:
      return 'border border-slate-500/35 bg-slate-500/15 text-slate-600 dark:text-slate-300'
  }
}

function SalesAreaChart({ data }: { data: GraphPoint[] }) {
  const w = 720
  const h = 240
  const pad = { t: 20, r: 8, b: 36, l: 8 }
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b

  if (!data.length) {
    return (
      <div
        className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400"
        role="img"
        aria-label="No chart data"
      >
        No sales in this range
      </div>
    )
  }

  const maxY = Math.max(...data.map((d) => d.value), 1)
  const n = data.length
  const stepX = n <= 1 ? 0 : innerW / (n - 1)

  const pts = data.map((d, i) => {
    const x = pad.l + (n <= 1 ? innerW / 2 : i * stepX)
    const y = pad.t + innerH - (d.value / maxY) * innerH
    return { x, y, label: d.label }
  })

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const areaPath = `${linePath} L${last.x},${pad.t + innerH} L${first.x},${pad.t + innerH} Z`

  const labelEvery = n <= 8 ? 1 : Math.max(1, Math.floor(n / 5))

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-[240px] w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Sales over time"
    >
      <defs>
        <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sales-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="#2563eb"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {pts.map((p, i) =>
        i % labelEvery === 0 || i === n - 1 ? (
          <text
            key={`${p.label}-${i}`}
            x={p.x}
            y={h - 10}
            textAnchor="middle"
            className="fill-slate-500 text-[10px] dark:fill-slate-400"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  )
}

function KpiStatCard({
  title,
  kpi,
  format,
}: {
  title: string
  kpi: KpiCard
  format: 'currency' | 'integer'
}) {
  const positive = kpi.trend === 'up'
  const displayMain =
    format === 'currency'
      ? formatInr(kpi.value, { maximumFractionDigits: 0 })
      : new Intl.NumberFormat('en-US').format(Math.round(kpi.value))

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <div className="flex items-start justify-between">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/15 text-blue-600"
          aria-hidden
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
            positive
              ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-red-500/35 bg-red-500/10 text-red-700 dark:text-red-300'
          }`}
        >
          {formatPct(kpi.changePercent)}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {displayMain}
      </p>
    </div>
  )
}

export function DashboardPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()
  const [period, setPeriod] = useState<DashboardPeriod>('monthly')
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchDashboardOverview(token, period)
      setOverview(data)
    } catch (e) {
      showApiError(e)
      setOverview(null)
    } finally {
      setLoading(false)
    }
  }, [token, period, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-full px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Dashboard Overview
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Welcome back, here is what&apos;s happening today
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => showToast('Create product is not available yet', 'info')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Product
          </button>
          <Link
            to="/coupons/new"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-50 transition hover:border-slate-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2M15 17v2M9 5v2M9 17v2" />
            </svg>
            Create Coupon
          </Link>
          <Link
            to="/promotions"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-50 transition hover:border-slate-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
            </svg>
            Promotion
          </Link>
        </div>
      </header>

      {loading && !overview ? (
        <div className="mt-10 flex justify-center text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      ) : null}

      {overview ? (
        <>
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStatCard title="Total Sales" kpi={overview.kpis.totalSales} format="currency" />
            <KpiStatCard title="Orders Today" kpi={overview.kpis.ordersToday} format="integer" />
            <KpiStatCard title="Total Customers" kpi={overview.kpis.totalCustomers} format="integer" />
            <KpiStatCard title="Revenue This Month" kpi={overview.kpis.revenueThisMonth} format="currency" />
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Sales Graph (
                  {period === 'monthly' ? 'Last 30 days' : 'Last 7 days'})
                </h2>
                <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5">
                  {(['weekly', 'monthly'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      disabled={loading}
                      className={[
                        'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition',
                        period === p
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-50',
                      ].join(' ')}
                    >
                      {p === 'weekly' ? 'Weekly' : 'Monthly'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <SalesAreaChart data={overview.salesGraph.data} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Top Selling Products
              </h2>
              <ul className="mt-4 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
                {overview.topSellingProducts.length === 0 ? (
                  <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No products yet</li>
                ) : (
                  overview.topSellingProducts.map((p) => (
                    <li key={p.id} className="flex gap-3 py-3 first:pt-0">
                      <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        {p.thumbnailUrl ? (
                          <img
                            src={resolveMediaUrl(p.thumbnailUrl)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
                          {p.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {new Intl.NumberFormat('en-US').format(p.totalSalesCount)} Sales
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-slate-900 dark:text-slate-50">
                        {formatInr(p.totalRevenue)}
                      </p>
                    </li>
                  ))
                )}
              </ul>
              <button
                type="button"
                className="mt-4 cursor-not-allowed text-sm font-medium text-blue-600 opacity-60 dark:text-blue-400"
                disabled
              >
                View Full Report
              </button>
            </div>
          </section>

          <section className="mt-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Recent Orders</h2>
              <button
                type="button"
                className="cursor-not-allowed text-sm font-medium text-blue-600 opacity-60 dark:text-blue-400"
                disabled
              >
                View All
              </button>
            </div>
            <RecentOrdersTable orders={overview.recentOrders} />
          </section>
        </>
      ) : null}
    </div>
  )
}

function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
  if (!orders.length) {
    return (
      <p className="px-5 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No orders yet</p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <th className="px-5 py-3">Order ID</th>
            <th className="px-5 py-3">Customer</th>
            <th className="px-5 py-3">Items</th>
            <th className="px-5 py-3">Total</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Date</th>
            <th className="px-5 py-3 w-12" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr
              key={o.orderId}
              className="border-b border-slate-200 last:border-0 hover:bg-slate-100/90 dark:border-slate-800 dark:hover:bg-slate-800/40"
            >
              <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-50">
                #{o.orderId}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${o.customer.avatarColor ? '' : 'bg-blue-600'}`}
                    style={
                      o.customer.avatarColor
                        ? { backgroundColor: o.customer.avatarColor }
                        : undefined
                    }
                  >
                    {o.customer.initials || '—'}
                  </span>
                  <span className="text-slate-900 dark:text-slate-50">{o.customer.name}</span>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                {o.itemsCount} {o.itemsCount === 1 ? 'Item' : 'Items'}
              </td>
              <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-50">
                {formatInr(o.total, { maximumFractionDigits: 2 })}
              </td>
              <td className="px-5 py-3.5">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(o.status)}`}
                >
                  {o.status}
                </span>
              </td>
              <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                {new Intl.DateTimeFormat('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date(o.date))}
              </td>
              <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50"
                  aria-label="Order actions"
                  disabled
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="5" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}