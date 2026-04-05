import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { adminScrollbarClass } from '../lib/admin-scrollbar'
import {
  readDrawerCollapsed,
  writeDrawerCollapsed,
} from '../lib/admin-drawer-storage'
import { AdminDrawer } from './admin-drawer'

export function AdminLayout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(readDrawerCollapsed)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileMenuOpen])

  const toggleDesktopCollapsed = useCallback(() => {
    setDesktopCollapsed((c) => {
      const next = !c
      writeDrawerCollapsed(next)
      return next
    })
  }, [])

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-slate-100 text-slate-900 dark:bg-[#0b1120] dark:text-slate-50">
      {mobileMenuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}

      <AdminDrawer
        collapsed={desktopCollapsed}
        onToggleCollapse={toggleDesktopCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#0a0c10] md:hidden">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-nav-drawer"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            Nyra Admin
          </span>
        </header>

        <div
          className={`${adminScrollbarClass} min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain`}
        >
          <Outlet />
        </div>
      </div>
    </div>
  )
}
