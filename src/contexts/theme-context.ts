import { createContext } from 'react'

export type AdminTheme = 'light' | 'dark'

export type ThemeContextValue = {
  theme: AdminTheme
  setTheme: (theme: AdminTheme) => void
  toggleTheme: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export const THEME_STORAGE_KEY = 'nyra-admin-theme'
