import { createContext } from 'react'

export const TOKEN_STORAGE_KEY = 'nyra_admin_token'
export const REFRESH_STORAGE_KEY = 'nyra_admin_refresh_token'

export type AuthContextValue = {
  token: string | null
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
