import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function Layout() {
  const { session, role } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {!isSupabaseConfigured && (
        <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
          Supabase is not configured — copy <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env</code> and fill in your project keys (see README).
          Sign-in and tests will not work until then.
        </div>
      )}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold tracking-tight text-indigo-700">
            Cefrly
            <span className="ml-2 text-sm font-normal text-slate-400">CEFR exam prep</span>
          </Link>
          {session ? (
            <div className="flex items-center gap-3 text-sm">
              {(role === 'admin' || role === 'super_admin') && (
                <Link to="/admin/tests" className="font-medium text-indigo-600 hover:underline">
                  Admin
                </Link>
              )}
              <Link to="/dashboard" className="font-medium text-indigo-600 hover:underline">
                My results
              </Link>
              <span className="hidden text-slate-500 sm:inline">{session.user.email}</span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
