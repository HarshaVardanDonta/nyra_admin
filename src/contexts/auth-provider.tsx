import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearAuthStorage,
  persistLoginSession,
  setAccessTokenListener,
} from '../lib/api/session'
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

  useEffect(() => {
    setAccessTokenListener(setToken)
    return () => setAccessTokenListener(null)
  }, [])

  const login = useCallback((accessToken: string, refreshToken: string) => {
    persistLoginSession(accessToken, refreshToken)
  }, [])

  const logout = useCallback(() => {
    clearAuthStorage()
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
