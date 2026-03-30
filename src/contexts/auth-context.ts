import { createContext } from 'react'

export const TOKEN_STORAGE_KEY = 'nyra_admin_token'

export type AuthContextValue = {
  token: string | null
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
