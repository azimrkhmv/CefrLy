import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function ProtectedRoute() {
  const { session, loading, role, onboardedAt } = useAuth()
  const location = useLocation()

  if (loading) {
    return <p className="py-24 text-center text-ink-soft">Loading…</p>
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  // Hold until the profile row arrives (role doubles as its loaded flag) so we
  // never flash the dashboard at a not-yet-onboarded user or vice versa.
  if (role === null) {
    return <p className="py-24 text-center text-ink-soft">Loading…</p>
  }

  // The /welcome wizard runs exactly once per account: no onboarded_at stamp
  // yet -> everything funnels there; stamped -> /welcome is closed (redirects
  // home), so it never reappears on later logins.
  const onWelcome = location.pathname === '/welcome'
  if (!onboardedAt && !onWelcome) {
    return <Navigate to="/welcome" replace />
  }
  if (onboardedAt && onWelcome) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
