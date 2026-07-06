import { useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { Logo } from './Logo'
import {
  BookIcon,
  ChartIcon,
  ChevronDownIcon,
  CloseIcon,
  GearIcon,
  HeadphonesIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  MicIcon,
  PenIcon,
  ShieldIcon,
  UsersIcon,
} from './icons'

// TODO: point this at the real community invite (Telegram/Discord/etc.).
const COMMUNITY_URL = 'https://t.me/cefrly'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
    isActive ? 'bg-brand text-white' : 'text-ink hover:bg-brand-soft hover:text-brand'
  }`

function SoonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold text-ink-faint"
      title="Coming soon"
    >
      {icon}
      {label}
      <span className="ml-auto rounded-full bg-page px-2 py-0.5 text-[10px] font-bold lowercase">
        soon
      </span>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { session, role } = useAuth()
  return (
    <div className="flex h-full flex-col gap-7 p-4">
      <div className="pt-3">
        <Logo className="px-2" />
      </div>

      <nav className="flex flex-col gap-1.5" aria-label="Main" onClick={onNavigate}>
        <NavLink to="/" end className={navLinkClass}>
          <HomeIcon width={18} height={18} />
          Home
        </NavLink>
        <NavLink to="/reading" className={navLinkClass}>
          <BookIcon width={18} height={18} />
          Reading
        </NavLink>
        <NavLink to="/listening" className={navLinkClass}>
          <HeadphonesIcon width={18} height={18} />
          Listening
        </NavLink>
        <SoonItem icon={<PenIcon width={18} height={18} />} label="Writing" />
        <SoonItem icon={<MicIcon width={18} height={18} />} label="Speaking" />
        {(session || role === 'admin' || role === 'super_admin') && (
          <div className="my-3 border-t border-line" aria-hidden />
        )}
        {session && (
          <NavLink to="/dashboard" className={navLinkClass}>
            <ChartIcon width={18} height={18} />
            My results
          </NavLink>
        )}
        {(role === 'admin' || role === 'super_admin') && (
          <NavLink to="/admin/tests" className={navLinkClass}>
            <ShieldIcon width={18} height={18} />
            Admin
          </NavLink>
        )}
      </nav>

      <div className="mt-auto space-y-3">
        {/* Reference layout: text on top, sleeping cat INSIDE the card below it,
            cushion resting on the card's bottom edge. */}
        <div className="overflow-hidden rounded-2xl bg-brand-soft px-4 pb-0 pt-3.5">
          <p className="text-sm font-extrabold text-brand-deep">Full mock test</p>
          <p className="mt-0.5 text-xs font-bold text-brand">
            35 questions · 5 parts · 60 minutes
          </p>
          <img
            src="/cat-cushion.png"
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none mx-auto -mb-1 mt-1.5 h-24 w-auto select-none"
          />
        </div>
        <a
          href={COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
        >
          <UsersIcon width={17} height={17} />
          Join CEFR Community
        </a>
      </div>
    </div>
  )
}

const PAGE_TITLES: [string, string][] = [
  ['/reading', 'Reading'],
  ['/listening', 'Listening'],
  ['/dashboard', 'My results'],
  ['/settings', 'Settings'],
  ['/test/', 'Test'],
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
  const p = location.pathname
  const PageIcon = p.startsWith('/reading')
    ? BookIcon
    : p.startsWith('/listening')
      ? HeadphonesIcon
      : p.startsWith('/dashboard')
        ? ChartIcon
        : p.startsWith('/settings')
          ? GearIcon
          : p.startsWith('/test/')
          ? BookIcon
          : p.startsWith('/results/')
            ? ChartIcon
            : HomeIcon

  return (
    <div className="min-h-screen bg-page text-ink">
      {!isSupabaseConfigured && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
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
              className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-soft hover:bg-page"
              aria-label="Close menu"
            >
              <CloseIcon />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 bg-page">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-1.5 text-ink hover:bg-white lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-heading shadow-card">
              <PageIcon width={15} height={15} className="text-brand" />
              {pageTitle}
            </span>
            <div className="ml-auto flex items-center">
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-full bg-white py-1 pl-1 pr-2 shadow-card transition-transform hover:scale-[1.03]"
                    aria-label="Account menu"
                    aria-expanded={menuOpen}
                  >
                    <img
                      src="/cat-face.png"
                      alt=""
                      aria-hidden
                      className="h-9 w-9 object-contain"
                    />
                    <ChevronDownIcon width={14} height={14} className="text-ink-soft" />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setMenuOpen(false)}
                        aria-hidden
                      />
                      <div className="absolute right-0 top-12 z-20 w-60 rounded-2xl border border-line bg-white py-1.5 shadow-pop">
                        <p className="truncate border-b border-line px-4 py-2.5 text-sm text-ink-soft">
                          {session.user.email}
                        </p>
                        <Link
                          to="/dashboard"
                          onClick={() => setMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm font-semibold text-ink hover:bg-page"
                        >
                          My results
                        </Link>
                        <Link
                          to="/settings"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-page"
                        >
                          <GearIcon width={16} height={16} />
                          Settings
                        </Link>
                        <button
                          onClick={() => supabase.auth.signOut()}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-page"
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
                  className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </header>

        <main
          key={location.pathname}
          className="page-enter mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
