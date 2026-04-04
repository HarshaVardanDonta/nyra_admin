import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'
import { useTheme } from '../contexts/use-theme'
import { adminScrollbarClass } from '../lib/admin-scrollbar'

type NavIconName =
  | 'dashboard'
  | 'orders'
  | 'box'
  | 'folder'
  | 'tag'
  | 'layers'
  | 'ticket'
  | 'megaphone'
  | 'users'
  | 'git'
  | 'chart'
  | 'settings'

type NavEntry =
  | { label: string; to: string; icon: NavIconName }
  | { label: string; disabled: true; icon: NavIconName }

function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const c = className ?? 'h-[18px] w-[18px]'
  switch (name) {
    case 'dashboard':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21h15V10.5" />
        </svg>
      )
    case 'orders':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M5 7h14l-1 12H6L5 7z" />
        </svg>
      )
    case 'box':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    case 'folder':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      )
    case 'tag':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    case 'layers':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      )
    case 'ticket':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2M15 17v2M9 5v2M9 17v2M3 11v2a1 1 0 001 1v6M21 11v2a1 1 0 01-1 1v6M5 9h14a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 012-2z" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5zM15 9a4 4 0 010 6M19 5a8 8 0 010 14" />
        </svg>
      )
    case 'users':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2M9 10a3 3 0 100-6 3 3 0 000 6zm8 0a3 3 0 100-6 3 3 0 000 6z" />
        </svg>
      )
    case 'git':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 3L4 14h7l-1 7 9-11h-7l1-7z" />
        </svg>
      )
    case 'chart':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M9 19v-6m5 6V9m5 10V4" />
        </svg>
      )
    case 'settings':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    default:
      return null
  }
}

function NavRow(props: NavEntry) {
  if ('disabled' in props && props.disabled) {
    return (
      <div
        className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-500 opacity-45 dark:text-slate-400"
        title="Coming soon"
      >
        <NavIcon name={props.icon} />
        <span>{props.label}</span>
      </div>
    )
  }
  if (!('to' in props)) return null
  const { to, label, icon } = props
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-blue-600/15 text-blue-600'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
        ].join(' ')
      }
    >
      <NavIcon name={icon} />
      <span>{label}</span>
    </NavLink>
  )
}

function NavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

export function AdminDrawer() {
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="flex h-full min-h-0 w-[260px] shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0a0c10]">
      <div className="flex items-center gap-2.5 px-5 py-6">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600"
          aria-hidden
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h15l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 4H3" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v4M14 11v4" />
          </svg>
        </span>
        <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          Nyra Admin
        </span>
      </div>

      <nav
        className={`${adminScrollbarClass} flex-1 overflow-y-auto px-3 pb-4`}
      >
        <NavGroup title="Main">
          <NavRow to="/dashboard" label="Dashboard" icon="dashboard" />
          <NavRow label="Orders" icon="orders" disabled />
          <NavRow to="/products" label="Products" icon="box" />
          <NavRow to="/categories" label="Categories" icon="folder" />
          <NavRow to="/brands" label="Brands" icon="tag" />
          <NavRow to="/collections" label="Collections" icon="layers" />
        </NavGroup>
        <NavGroup title="Marketing">
          <NavRow label="Coupons" icon="ticket" disabled />
          <NavRow to="/promotions" label="Promotions" icon="megaphone" />
        </NavGroup>
        <NavGroup title="System">
          <NavRow label="Customers" icon="users" disabled />
          <NavRow label="Order lifecycle" icon="git" disabled />
          <NavRow to="/analytics" label="Analytics" icon="chart" />
          <NavRow label="Settings" icon="settings" disabled />
        </NavGroup>
      </nav>

      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl bg-slate-50/90 px-3 py-3 dark:bg-slate-900/80">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">
              Admin
            </p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              Administrator
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 py-2 text-xs font-medium text-slate-900 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:hover:border-slate-600"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <>
              <svg className="h-4 w-4 text-amber-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0-16a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zM5.64 5.64a1 1 0 011.41 0l.71.71A1 1 0 11 6.34 7.05l-.71-.71a1 1 0 010-1.7zm12.02 12.02a1 1 0 01-1.41 0l-.71-.71a1 1 0 111.41-1.41l.71.71a1 1 0 010 1.41zM4 12a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm14 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM6.34 16.95a1 1 0 010-1.41l.71-.71a1 1 0 111.41 1.41l-.71.71a1 1 0 01-1.41 0zm12.02-12.02a1 1 0 010 1.41l-.71.71a1 1 0 11-1.41-1.41l.71-.71a1 1 0 011.41 0z" />
              </svg>
              Light mode
            </>
          ) : (
            <>
              <svg className="h-4 w-4 text-slate-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M21 14.5A8.5 8.5 0 0111.5 5a8.5 8.5 0 108.5 9.5z" />
              </svg>
              Dark mode
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-2 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-50"
        >
          Log out
        </button>
      </div>
    </aside>
  )
}
