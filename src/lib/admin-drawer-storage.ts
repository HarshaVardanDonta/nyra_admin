export const ADMIN_DRAWER_COLLAPSED_KEY = 'nyra-admin-drawer-collapsed'

export function readDrawerCollapsed(): boolean {
  try {
    return localStorage.getItem(ADMIN_DRAWER_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function writeDrawerCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(ADMIN_DRAWER_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}
