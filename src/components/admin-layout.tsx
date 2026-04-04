import { Outlet } from 'react-router-dom'
import { adminScrollbarClass } from '../lib/admin-scrollbar'
import { AdminDrawer } from './admin-drawer'

export function AdminLayout() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-slate-100 text-slate-900 dark:bg-[#0b1120] dark:text-slate-50">
      <AdminDrawer />
      <div
        className={`${adminScrollbarClass} min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain`}
      >
        <Outlet />
      </div>
    </div>
  )
}
