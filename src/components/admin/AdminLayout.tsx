import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'
  }`

export function AdminLayout() {
  const { session, role } = useAuth()

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center gap-3 px-4 py-2">
          <Link to="/admin/tests" className="text-lg font-bold tracking-tight">
            Cefrly <span className="text-indigo-600">Admin</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Admin">
            <NavLink to="/admin/tests" end className={navLinkClass}>
              Tests
            </NavLink>
            <NavLink to="/admin/tests/new" className={navLinkClass}>
              + New test
            </NavLink>
            {role === 'super_admin' && (
              <NavLink to="/admin/admins" className={navLinkClass}>
                Admins
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link to="/" className="text-indigo-600 hover:underline">
              ← Student site
            </Link>
            <span className="hidden text-slate-500 md:inline">{session?.user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
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
