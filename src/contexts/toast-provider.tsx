import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getErrorMessage } from '../lib/api/errors'
import { ToastContext, type ToastTone } from './toast-context'

type ToastItem = { id: number; message: string; tone: ToastTone }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5200)
  }, [])

  const showApiError = useCallback(
    (err: unknown) => {
      showToast(getErrorMessage(err), 'error')
    },
    [showToast],
  )

  const value = useMemo(
    () => ({ showToast, showApiError }),
    [showToast, showApiError],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              'pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg shadow-slate-900/15 dark:shadow-black/40',
              t.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/35 dark:bg-red-950/95 dark:text-red-100'
                : t.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/35 dark:bg-emerald-950/95 dark:text-emerald-100'
                  : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50',
            ].join(' ')}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
