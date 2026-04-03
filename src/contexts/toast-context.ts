import { createContext } from 'react'

export type ToastTone = 'error' | 'success' | 'info'

export type ToastContextValue = {
  showToast: (message: string, tone?: ToastTone) => void
  showApiError: (err: unknown) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
