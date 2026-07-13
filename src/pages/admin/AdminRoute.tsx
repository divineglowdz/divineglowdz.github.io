import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

export function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <div className="admin-loading">Verification de la session...</div>
  if (!session || !profile || !profile.active || !['admin', 'staff'].includes(profile.role)) return <Navigate to="/admin/login" replace />
  return children
}
