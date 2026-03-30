import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/use-auth'

export function HomeRedirect() {
  const { isAuthenticated } = useAuth()
  return (
    <Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />
  )
}
