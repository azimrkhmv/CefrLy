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
    <Link to="/" className="flex items-center gap-3 px-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-deep text-lg font-bold text-white">
        C
      </span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold uppercase tracking-[0.08em] text-[#26253a]">
          Cefrly
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
          CEFR Exams
        </span>
      </span>
    </Link>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-4 rounded-xl px-4 py-3 text-base transition-colors ${
    isActive ? 'bg-brand font-medium text-white' : 'font-medium text-[#26253a] hover:bg-page'
  }`

function SoonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      className="flex cursor-not-allowed items-center gap-4 rounded-xl px-4 py-3 text-base font-medium text-[#26253a]/40"
      title="Coming soon"
    >
      {icon}
      {label}
      <span className="ml-auto text-[11px] font-medium lowercase text-ink-faint">soon</span>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { session, role } = useAuth()
  return (
    <div className="flex h-full flex-col gap-9 p-5">
      <div className="pt-4">
        <Logo />
      </div>

      <nav className="flex flex-col gap-2.5" aria-label="Main" onClick={onNavigate}>
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

      <div className="mt-auto space-y-3.5 border-t border-line pt-5">
        <div className="rounded-xl bg-brand-soft/70 px-4 py-3.5">
          <p className="text-[15px] font-semibold text-[#26253a]">Full mock test</p>
          <p className="mt-0.5 text-[13px] font-medium text-brand-mid">
            35 questions · 5 parts · 60 minutes
          </p>
        </div>
        {session ? (
          <Link
            to="/reading"
            onClick={onNavigate}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-bright px-4 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-brand"
          >
            <PlayIcon width={13} height={13} />
            Start Reading test
          </Link>
        ) : (
          <Link
            to="/login"
            onClick={onNavigate}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-brand-bright px-4 py-3.5 text-[15px] font-medium text-white transition-colors hover:bg-brand"
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
    <div className="min-h-screen bg-page text-ink">
      {!isSupabaseConfigured && (
        <div className="bg-sun-soft px-4 py-2 text-center text-sm font-medium text-sun-ink">
          Supabase is not configured — copy <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env</code> and fill in your project keys (see README).
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-line bg-white lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
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

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 bg-white">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-heading hover:bg-page lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <span className="rounded-lg bg-[#f1edfa] px-5 py-2 text-[15px] font-semibold text-heading">
              {pageTitle}
            </span>
            <div className="ml-auto flex items-center gap-3">
              {session ? (
                <>
                  <span className="hidden text-sm text-ink-soft md:inline">
                    {session.user.email}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                    {initial}
                  </span>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-heading hover:bg-page"
                  >
                    <LogoutIcon width={16} height={16} />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <div
          className="min-h-[calc(100vh-72px)]"
          style={{ background: 'linear-gradient(180deg, #f2edfb 0%, #f7f5ff 260px)' }}
        >
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
