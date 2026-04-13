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
  | 'gift'
  | 'filter'
  | 'document'
  | 'layout'
  | 'users'
  | 'git'
  | 'chart'
  | 'star'
  | 'truck'
  | 'settings'

type NavEntry =
  | { label: string; to: string; icon: NavIconName }
  | { label: string; disabled: true; icon: NavIconName }

export type AdminDrawerProps = {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileMenuOpen: boolean
  onCloseMobileMenu: () => void
}

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
    case 'gift':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14v9a2 2 0 01-2 2H7a2 2 0 01-2-2v-9zm0-4h14a2 2 0 012 2v2H3V6a2 2 0 012-2z"
          />
        </svg>
      )
    case 'filter':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
          />
        </svg>
      )
    case 'document':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6M7 4h6l4 4v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z"
          />
        </svg>
      )
    case 'layout':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v6H4V5zM4 13h10v6H4v-6zM16 13h4v6h-4v-6z" />
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
    case 'star':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.065 4.502 4.978.458a.563.563 0 0 1 .322.97l-3.67 3.405 1.05 4.783a.562.562 0 0 1-.844.59l-4.347-2.45-4.347 2.45a.563.563 0 0 1-.844-.59l1.05-4.783-3.67-3.405a.563.563 0 0 1 .322-.97l4.978-.458 2.065-4.502Z"
          />
        </svg>
      )
    case 'truck':
      return (
        <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
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

function NavRow(props: NavEntry & { collapsed: boolean }) {
  const { collapsed } = props
  if ('disabled' in props && props.disabled) {
    return (
      <div
        className={[
          'flex cursor-not-allowed items-center rounded-lg py-2 text-sm text-slate-500 opacity-45 dark:text-slate-400',
          collapsed ? 'justify-center px-2' : 'gap-3 px-3',
        ].join(' ')}
        title="Coming soon"
      >
        <NavIcon name={props.icon} />
        <span className={collapsed ? 'sr-only' : ''}>{props.label}</span>
      </div>
    )
  }
  if (!('to' in props)) return null
  const { to, label, icon } = props
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        [
          'flex items-center rounded-lg text-sm font-medium transition',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
          isActive
            ? 'bg-blue-600/15 text-blue-600'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white',
        ].join(' ')
      }
    >
      <NavIcon name={icon} />
      <span className={collapsed ? 'sr-only' : ''}>{label}</span>
    </NavLink>
  )
}

function NavGroup({
  title,
  collapsed,
  children,
}: {
  title: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className={collapsed ? 'mt-4 first:mt-0' : 'mt-6 first:mt-0'}>
      <p
        className={[
          'mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500',
          collapsed ? 'sr-only' : '',
        ].join(' ')}
      >
        {title}
      </p>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  )
}

export function AdminDrawer({
  collapsed,
  onToggleCollapse,
  mobileMenuOpen,
  onCloseMobileMenu,
}: AdminDrawerProps) {
  const { logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const asideTransform = mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full'

  return (
    <aside
      id="admin-nav-drawer"
      aria-label="Main navigation"
      className={[
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0a0c10]',
        'fixed inset-y-0 left-0 z-50 w-[260px] transition-[transform,width] duration-200 ease-out md:relative md:z-auto md:translate-x-0',
        asideTransform,
        collapsed ? 'md:w-[72px]' : 'md:w-[260px]',
      ].join(' ')}
    >
      <div
        className={[
          'flex shrink-0 items-center gap-2 border-b border-slate-200 dark:border-slate-800 md:border-transparent md:pb-0',
          collapsed ? 'flex-col px-2 py-4 md:py-5' : 'justify-between px-4 py-4 md:px-5 md:py-6',
        ].join(' ')}
      >
        <div
          className={[
            'flex min-w-0 items-center gap-2.5',
            collapsed ? 'md:flex-col md:justify-center' : 'flex-1',
          ].join(' ')}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600"
            aria-hidden
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 8h15l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 4H3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 11v4M14 11v4" />
            </svg>
          </span>
          <span
            className={
              collapsed
                ? 'sr-only'
                : 'truncate text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50'
            }
          >
            Nyra Admin
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white md:hidden"
            onClick={onCloseMobileMenu}
            aria-label="Close navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white md:flex"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h14" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 12H4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <nav
        className={`${adminScrollbarClass} min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2 pb-4 md:px-3`}
      >
        <NavGroup title="Main" collapsed={collapsed}>
          <NavRow to="/dashboard" label="Dashboard" icon="dashboard" collapsed={collapsed} />
          <NavRow to="/orders" label="Orders" icon="orders" collapsed={collapsed} />
          <NavRow to="/products" label="Products" icon="box" collapsed={collapsed} />
          <NavRow to="/categories" label="Categories" icon="folder" collapsed={collapsed} />
          <NavRow to="/brands" label="Brands" icon="tag" collapsed={collapsed} />
          <NavRow to="/collections" label="Collections" icon="layers" collapsed={collapsed} />
        </NavGroup>
        <NavGroup title="Marketing" collapsed={collapsed}>
          <NavRow to="/coupons" label="Coupons" icon="ticket" collapsed={collapsed} />
          <NavRow to="/promotions" label="Promotions" icon="megaphone" collapsed={collapsed} />
          <NavRow to="/exclusive-offers" label="Exclusive offers" icon="gift" collapsed={collapsed} />
          <NavRow
            to="/exclusive-offers/filter-categories"
            label="Offer filter categories"
            icon="filter"
            collapsed={collapsed}
          />
          <NavRow to="/blogs" label="Blogs" icon="document" collapsed={collapsed} />
          <NavRow to="/blog-promotions" label="Blog promotions" icon="layout" collapsed={collapsed} />
        </NavGroup>
        <NavGroup title="System" collapsed={collapsed}>
          <NavRow to="/delivery-pincode-rules" label="Delivery pincodes" icon="truck" collapsed={collapsed} />
          <NavRow to="/store-tax" label="Store tax" icon="settings" collapsed={collapsed} />
          <NavRow to="/users" label="Users" icon="users" collapsed={collapsed} />
          <NavRow to="/order-lifecycle" label="Order lifecycle" icon="git" collapsed={collapsed} />
          <NavRow to="/analytics" label="Analytics" icon="chart" collapsed={collapsed} />
          <NavRow to="/reviews-insights" label="Reviews" icon="star" collapsed={collapsed} />
        </NavGroup>
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800 md:p-4">
        <div
          className={[
            'flex items-center rounded-xl bg-slate-50/90 dark:bg-slate-900/80',
            collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-3',
          ].join(' ')}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
            A
          </span>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-50">Admin</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">Administrator</p>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className={[
            'mt-3 flex w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-100 py-2 text-xs font-medium text-slate-900 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:hover:border-slate-600',
            collapsed ? 'gap-0 px-2' : 'gap-2',
          ].join(' ')}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? (
            <svg className="h-4 w-4 shrink-0 text-amber-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M12 18a6 6 0 100-12 6 6 0 000 12zm0-16a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm0 18a1 1 0 01-1-1v-1a1 1 0 112 0v1a1 1 0 01-1 1zM5.64 5.64a1 1 0 011.41 0l.71.71A1 1 0 11 6.34 7.05l-.71-.71a1 1 0 010-1.7zm12.02 12.02a1 1 0 01-1.41 0l-.71-.71a1 1 0 111.41-1.41l.71.71a1 1 0 010 1.41zM4 12a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm14 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM6.34 16.95a1 1 0 010-1.41l.71-.71a1 1 0 111.41 1.41l-.71.71a1 1 0 01-1.41 0zm12.02-12.02a1 1 0 010 1.41l-.71.71a1 1 0 11-1.41-1.41l.71-.71a1 1 0 011.41 0z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 text-slate-600" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M21 14.5A8.5 8.5 0 0111.5 5a8.5 8.5 0 108.5 9.5z" />
            </svg>
          )}
          {!collapsed ? <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span> : null}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          className={[
            'mt-2 w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-50',
            collapsed ? 'px-2' : '',
          ].join(' ')}
          aria-label="Log out"
        >
          {collapsed ? (
            <span className="flex justify-center" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
          ) : (
            'Log out'
          )}
        </button>
      </div>
    </aside>
  )
}
