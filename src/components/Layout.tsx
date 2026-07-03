import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import {
  BookIcon,
  ChartIcon,
  CloseIcon,
  HeadphonesIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  MicIcon,
  PenIcon,
  PlayIcon,
  ShieldIcon,
} from './icons'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 px-2">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-deep text-xl font-black text-white">
        C
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-black tracking-tight text-heading">Cefrly</span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">
          CEFR Exams
        </span>
      </span>
    </Link>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-bold transition-colors ${
    isActive ? 'bg-brand text-white shadow-pop' : 'text-heading/80 hover:bg-brand-soft/70'
  }`

function SoonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-[15px] font-bold text-heading/40">
      {icon}
      {label}
      <span className="ml-auto rounded-full bg-sun-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-sun-ink">
        Soon
      </span>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { session, role } = useAuth()
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="pt-2">
        <Logo />
      </div>

      <nav className="flex flex-col gap-1" aria-label="Main" onClick={onNavigate}>
        <NavLink to="/" end className={navLinkClass}>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/reading" className={navLinkClass}>
          <BookIcon />
          Reading
        </NavLink>
        <SoonItem icon={<HeadphonesIcon />} label="Listening" />
        <SoonItem icon={<PenIcon />} label="Writing" />
        <SoonItem icon={<MicIcon />} label="Speaking" />
        {session && (
          <NavLink to="/dashboard" className={navLinkClass}>
            <ChartIcon />
            My results
          </NavLink>
        )}
        {(role === 'admin' || role === 'super_admin') && (
          <NavLink to="/admin/tests" className={navLinkClass}>
            <ShieldIcon />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="mt-auto space-y-3">
        <div className="rounded-2xl bg-brand-soft p-4">
          <p className="text-sm font-extrabold text-heading">Full mock test</p>
          <p className="mt-0.5 text-xs font-semibold text-ink-soft">
            35 questions · 5 parts · 60 minutes
          </p>
        </div>
        {session ? (
          <Link
            to="/reading"
            onClick={onNavigate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-extrabold text-white shadow-pop transition-colors hover:bg-brand-deep"
          >
            <PlayIcon width={14} height={14} />
            Start Reading test
          </Link>
        ) : (
          <Link
            to="/login"
            onClick={onNavigate}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-extrabold text-white shadow-pop transition-colors hover:bg-brand-deep"
          >
            Sign in — it's free
          </Link>
        )}
      </div>
    </div>
  )
}

const PAGE_TITLES: [string, string][] = [
  ['/reading', 'Reading'],
  ['/dashboard', 'My results'],
  ['/test/', 'Reading test'],
  ['/results/', 'Results'],
  ['/handoff', 'Signing you in'],
]

export function Layout() {
  const { session } = useAuth()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const pageTitle =
    PAGE_TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ?? 'Home'
  const initial = session?.user.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="min-h-screen bg-base text-ink">
      {!isSupabaseConfigured && (
        <div className="bg-sun-soft px-4 py-2 text-center text-sm font-semibold text-sun-ink">
          Supabase is not configured — copy <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env</code> and fill in your project keys (see README).
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-heading/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-pop">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-soft hover:bg-brand-soft"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-base/80 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-heading hover:bg-brand-soft lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <span className="rounded-xl bg-white px-4 py-1.5 text-sm font-extrabold text-heading shadow-card">
              {pageTitle}
            </span>
            <div className="ml-auto flex items-center gap-3">
              {session ? (
                <>
                  <span className="hidden text-sm font-semibold text-ink-soft md:inline">
                    {session.user.email}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-extrabold text-brand">
                    {initial}
                  </span>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-1.5 text-sm font-bold text-heading hover:bg-brand-soft"
                  >
                    <LogoutIcon width={16} height={16} />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white hover:bg-brand-deep"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
