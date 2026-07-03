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
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-lg font-bold text-white">
        C
      </span>
      <span className="leading-tight">
        <span className="block text-[17px] font-bold uppercase tracking-[0.08em] text-ink">
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
  `flex items-center gap-4 rounded-xl px-5 py-2.5 text-[16px] transition-colors ${
    isActive ? 'bg-brand font-medium text-white' : 'font-medium text-ink hover:bg-page'
  }`

function SoonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      className="flex cursor-not-allowed items-center gap-4 rounded-xl px-5 py-2.5 text-[16px] font-medium text-ink/40"
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
        {(session || role === 'admin' || role === 'super_admin') && (
          <div className="my-3 border-t border-line" aria-hidden />
        )}
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
        <div className="rounded-xl bg-[#faf5ff] px-4 py-3.5">
          <p className="text-[15px] font-semibold text-[#581c87]">Full mock test</p>
          <p className="mt-0.5 text-[13px] font-medium text-brand-bright">
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
            Sign in
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
  const [menuOpen, setMenuOpen] = useState(false)

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[330px] border-r border-line bg-white lg:block">
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

      <div className="lg:pl-[330px]">
        <header className="sticky top-0 z-20 bg-white">
          <div className="flex h-[72px] items-center gap-3 px-4 sm:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-heading hover:bg-page lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <span className="rounded-lg bg-brand-soft px-5 py-2 text-[15px] font-medium text-heading">
              {pageTitle}
            </span>
            <div className="ml-auto flex items-center">
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand"
                    aria-label="Account menu"
                    aria-expanded={menuOpen}
                  >
                    {initial}
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden
                      />
                      <div className="absolute right-0 top-12 z-20 w-60 rounded-xl border border-line bg-white py-1.5 shadow-pop">
                        <p className="truncate border-b border-line px-4 py-2.5 text-sm text-ink-soft">
                          {session.user.email}
                        </p>
                        <Link
                          to="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-[15px] text-ink hover:bg-page"
                        >
                          My results
                        </Link>
                        <button
                          onClick={() => supabase.auth.signOut()}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-[15px] text-ink hover:bg-page"
                        >
                          <LogoutIcon width={16} height={16} />
                          Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
