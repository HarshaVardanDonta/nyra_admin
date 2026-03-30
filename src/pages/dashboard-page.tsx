import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'

export function DashboardPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-svh bg-[var(--admin-bg)] text-[var(--admin-text)]">
      <header className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]"
              aria-hidden
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 8h15l-1.5 9.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.5L5 4H3" />
                <path d="M10 11v4M14 11v4" />
              </svg>
            </span>
            <span className="font-semibold text-white">Nyra Admin</span>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-elevated)] px-3 py-1.5 text-sm text-[var(--admin-muted)] transition hover:border-slate-500 hover:text-white"
          >
            Log out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-2 max-w-xl text-[var(--admin-muted)]">
          You are signed in. This is a placeholder screen; navigation and
          modules will be added here.
        </p>
        <div className="mt-8 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <p className="text-sm text-[var(--admin-muted)]">
            Admin tools and analytics will appear in this area.
          </p>
        </div>
      </main>
    </div>
  )
}
