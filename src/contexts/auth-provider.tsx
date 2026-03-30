import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, TOKEN_STORAGE_KEY } from './auth-context'

function readStoredToken(): string | null {
  try {
    const v = localStorage.getItem(TOKEN_STORAGE_KEY)
    return v?.trim() ? v : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStoredToken())

  const login = useCallback((next: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, next)
    setToken(next)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      login,
      logout,
    }),
    [token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
