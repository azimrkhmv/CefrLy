import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

// The UI-side gate for /admin/*. The real enforcement is server-side: every
// admin action goes through edge functions that re-check profiles.role.
export function AdminRoute() {
  const { session, loading, role, roleLoading } = useAuth()
  const location = useLocation()

  if (loading || (session && roleLoading)) {
    return <p className="py-24 text-center text-slate-400">Loading…</p>
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (role !== 'admin' && role !== 'super_admin') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}

// Nested inside AdminRoute: only the super admin may manage admins.
export function SuperAdminRoute() {
  const { role } = useAuth()
  if (role !== 'super_admin') {
    return <Navigate to="/admin/tests" replace />
  }
  return <Outlet />
}
