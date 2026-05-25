import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div style={{ color: '#666', fontSize: 14 }}>Loading...</div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
