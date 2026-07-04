import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
    isActive ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink'
  }`

export function AdminLayout() {
  const { session, role } = useAuth()

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-3 px-4 py-2">
          <Link to="/admin/tests" className="text-lg font-extrabold tracking-tight text-heading">
            Cefrly <span className="text-brand">Admin</span>
          </Link>
          <nav className="inline-flex items-center rounded-xl border border-line bg-white p-1" aria-label="Admin">
            <NavLink to="/admin/tests" end className={navLinkClass}>
              Tests
            </NavLink>
            <NavLink to="/admin/tests/new" className={navLinkClass}>
              New test
            </NavLink>
            {role === 'super_admin' && (
              <NavLink to="/admin/admins" className={navLinkClass}>
                Admins
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/" className="font-bold text-brand hover:underline">
              Student site
            </Link>
            <span className="hidden text-ink-soft md:inline">{session?.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
