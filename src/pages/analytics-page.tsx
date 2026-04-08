import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../contexts/use-auth'
import { useToast } from '../contexts/use-toast'
import {
  type AnalyticsPeriod,
  type AnalyticsResponse,
  type Trend,
  downloadAnalyticsExport,
  fetchAnalytics,
} from '../lib/api/analytics'
import { getErrorMessage } from '../lib/api/errors'
import { resolveMediaUrl } from '../lib/media-url'

const PERIODS: { id: AnalyticsPeriod; label: string }[] = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '1y', label: 'Last year' },
]

const CHART_GRID = '#334155'
const CHART_AXIS = '#64748b'
const LINE_CURRENT = '#3b82f6'
const LINE_PREV = '#64748b'

/** Recharts defaults to -1×-1 until resize; that spams console warnings. Seed a sane box, then RO corrects it. */
const RESPONSIVE_CHART_INITIAL = { width: 480, height: 280 } as const

function formatInr(n: number, fractionDigits = 2) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n)
}

function formatPctChange(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function formatCompactInt(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

function trendBadgeClass(t: Trend) {
  return t === 'up'
    ? 'text-emerald-500 dark:text-emerald-400'
    : 'text-rose-500 dark:text-rose-400'
}

function KpiCard({
  title,
  value,
  change,
  trend,
  icon,
}: {
  title: string
  value: string
  change: string
  trend: Trend
  icon: ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-600"
          aria-hidden
        >
          {icon}
        </span>
        <span className={`text-sm font-semibold ${trendBadgeClass(trend)}`}>
          {change}
        </span>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        {value}
      </p>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-1">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
          {title}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="mt-4 h-[280px] min-h-[280px] w-full min-w-0">{children}</div>
    </div>
  )
}

export function AnalyticsPage() {
  const { token } = useAuth()
  const { showApiError, showToast } = useToast()
  const [period, setPeriod] = useState<AnalyticsPeriod>('30d')
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetchAnalytics(token, period)
      setData(res)
    } catch (e) {
      showApiError(e)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [token, period, showApiError])

  useEffect(() => {
    void load()
  }, [load])

  async function handleExport() {
    if (!token) return
    setExporting(true)
    try {
      await downloadAnalyticsExport(token, period)
      showToast('Export downloaded', 'success')
    } catch (e) {
      showToast(getErrorMessage(e), 'error')
    } finally {
      setExporting(false)
    }
  }

  const revData =
    data?.revenue_growth.data.map((d) => ({
      label: d.label,
      current: d.current,
      previous: d.previous,
    })) ?? []

  const ordData =
    data?.daily_orders.data.map((d) => ({
      label: d.label,
      orders: d.value,
    })) ?? []

  const custData =
    data?.customer_growth.data.map((d) => ({
      label: d.label,
      newCustomers: d.new_customers,
    })) ?? []

  const kpis = data?.kpis

  return (
    <div className="min-h-full min-w-0 max-w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Overview of your shop&apos;s performance
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={loading}
                onClick={() => setPeriod(p.id)}
                className={[
                  'rounded-md px-3 py-1.5 text-xs font-medium transition',
                  period === p.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-50',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={exporting || !token}
            onClick={() => void handleExport()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
              />
            </svg>
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </header>

      {loading && !data ? (
        <div className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading…
        </div>
      ) : null}

      {data && kpis ? (
        <>
          <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Revenue"
              value={formatInr(kpis.total_revenue.value)}
              change={formatPctChange(kpis.total_revenue.change_percent)}
              trend={kpis.total_revenue.trend}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Total Orders"
              value={formatCompactInt(kpis.total_orders.value)}
              change={formatPctChange(kpis.total_orders.change_percent)}
              trend={kpis.total_orders.trend}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Avg. Order Value"
              value={formatInr(kpis.avg_order_value.value)}
              change={formatPctChange(kpis.avg_order_value.change_percent)}
              trend={kpis.avg_order_value.trend}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <KpiCard
              title="Conversion Rate"
              value={`${kpis.conversion_rate.value.toFixed(1)}%`}
              change={formatPctChange(kpis.conversion_rate.change_percent)}
              trend={kpis.conversion_rate.trend}
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" d="M12 3v2M12 19v2M3 12h2M19 12h2" />
                </svg>
              }
            />
          </section>

          <section className="mt-8 grid min-w-0 gap-6 lg:grid-cols-2">
            <ChartCard title="Revenue Growth" subtitle={data.revenue_growth.label}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={280}
                initialDimension={RESPONSIVE_CHART_INITIAL}
              >
                <LineChart data={revData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} />
                  <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} width={48} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-800">
                          <p className="mb-1 font-medium text-slate-900 dark:text-slate-50">{label}</p>
                          {payload.map((entry) => (
                            <p key={String(entry.dataKey)} className="text-slate-600 dark:text-slate-300">
                              <span style={{ color: entry.color }}>{entry.name}: </span>
                              {typeof entry.value === 'number' ? formatInr(entry.value) : entry.value}
                            </p>
                          ))}
                        </div>
                      )
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line name="This period" type="monotone" dataKey="current" stroke={LINE_CURRENT} strokeWidth={2} dot={false} />
                  <Line name="Previous period" type="monotone" dataKey="previous" stroke={LINE_PREV} strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Daily Orders" subtitle={data.daily_orders.label}>
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={280}
                initialDimension={RESPONSIVE_CHART_INITIAL}
              >
                <BarChart data={ordData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} opacity={0.5} />
                  <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} />
                  <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} allowDecimals={false} width={36} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null
                      const v = payload[0]?.value
                      return (
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-800">
                          <p className="font-medium text-slate-900 dark:text-slate-50">{label}</p>
                          <p className="text-slate-600 dark:text-slate-300">{typeof v === 'number' ? `${v} orders` : v}</p>
                        </div>
                      )
                    }}
                  />
                  <Bar dataKey="orders" name="Orders" fill={LINE_CURRENT} radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </section>

          <section className="mt-8 grid min-w-0 gap-6 lg:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Top Products
                </h2>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 opacity-50 dark:text-blue-400"
                  disabled
                >
                  View All
                </button>
              </div>
              <ul className="mt-4 flex flex-col divide-y divide-slate-200 dark:divide-slate-700">
                {data.top_products.length === 0 ? (
                  <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No products
                  </li>
                ) : (
                  data.top_products.map((p) => (
                    <li key={p.id} className="flex gap-3 py-3 first:pt-0">
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        {p.thumbnail_url ? (
                          <img src={resolveMediaUrl(p.thumbnail_url)} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{p.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCompactInt(p.sales_count)} sales
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-slate-900 dark:text-slate-50">
                        {formatInr(p.revenue, 0)}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Top Categories
              </h2>
              <ul className="mt-4 flex flex-col gap-4">
                {data.top_categories.length === 0 ? (
                  <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No categories
                  </li>
                ) : (
                  data.top_categories.map((c) => (
                    <li key={c.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-900 dark:text-slate-50">{c.name}</span>
                        <span className="text-slate-500 dark:text-slate-400">{c.revenue_share_percent}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, c.revenue_share_percent))}%` }}
                        />
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                  Top users
                </h2>
                <button
                  type="button"
                  className="text-xs font-medium text-blue-600 opacity-50 dark:text-blue-400"
                  disabled
                >
                  View All
                </button>
              </div>
              <ul className="mt-4 flex flex-col divide-y divide-slate-200 dark:divide-slate-700">
                {data.top_customers.length === 0 ? (
                  <li className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    No users yet
                  </li>
                ) : (
                  data.top_customers.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-3 first:pt-0">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${c.avatar_color ? '' : 'bg-blue-600'}`}
                        style={
                          c.avatar_color ? { backgroundColor: c.avatar_color } : undefined
                        }
                      >
                        {c.initials || '—'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">{c.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCompactInt(c.order_count)} orders
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-slate-900 dark:text-slate-50">
                        {formatInr(c.total_spent, 0)}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>

          <section className="mt-8 min-w-0">
            <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                    Customer Growth
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {data.customer_growth.label}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                  New Customers
                </div>
              </div>
              <div className="mt-4 h-[280px] min-h-[280px] w-full min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                  minWidth={0}
                  minHeight={280}
                  initialDimension={RESPONSIVE_CHART_INITIAL}
                >
                  <LineChart data={custData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} opacity={0.5} />
                    <XAxis dataKey="label" tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} />
                    <YAxis tick={{ fill: CHART_AXIS, fontSize: 11 }} axisLine={{ stroke: CHART_GRID }} allowDecimals={false} width={36} />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const v = payload[0]?.value
                        return (
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-slate-600 dark:bg-slate-800">
                            <p className="font-medium text-slate-900 dark:text-slate-50">{label}</p>
                            <p className="text-slate-600 dark:text-slate-300">
                              {typeof v === 'number' ? `${v} new` : v}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="newCustomers"
                      name="New Customers"
                      stroke={LINE_CURRENT}
                      strokeWidth={2}
                      dot={{ r: 4, fill: LINE_CURRENT, strokeWidth: 0 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
