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
  DollarIcon,
  HeadphonesIcon,
  HomeIcon,
  LifebuoyIcon,
  LogoutIcon,
  MenuIcon,
  MicIcon,
  PenIcon,
  StarIcon,
  UsersIcon,
} from './icons'

// TODO: point this at the real community invite (Telegram/Discord/etc.).
export const COMMUNITY_URL = 'https://t.me/cefrly'

// Sidebar design "2b — Rail & tint": quiet muted rows; the active row gets a
// 3px brand rail on the left plus a lavender tint fading to the right.
const navItemBase =
  'group relative flex items-center gap-3.5 rounded-[10px] py-2 text-sm font-bold transition-colors'

function NavItem({
  to,
  end,
  icon,
  label,
  onNavigate,
}: {
  to: string
  end?: boolean
  icon: ReactNode
  label: string
  onNavigate?: () => void
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${navItemBase} ${
          isActive
            ? 'bg-gradient-to-r from-brand-soft to-transparent pl-4 pr-3 text-brand'
            : 'px-3 text-ink-soft hover:bg-page'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" />
          )}
          <span className={isActive ? 'text-brand' : 'text-ink-faint group-hover:text-ink-soft'}>
            {icon}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SoonItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className={`${navItemBase} px-3 text-ink-faint`} title="Coming soon">
      <span className="text-ink-faint">{icon}</span>
      <span>{label}</span>
      <span className="ml-auto rounded-full border border-line px-2 py-0.5 text-[10px] font-bold lowercase text-ink-faint">
        soon
      </span>
    </div>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint">
      {children}
    </p>
  )
}

function MockStat({ num, label }: { num: string; label: string }) {
  return (
    <div>
      <div className="text-[17px] font-extrabold tabular-nums leading-none text-brand">{num}</div>
      <div className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-ink-soft">
        {label}
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth()
  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      <div className="px-2 pb-4 pt-1">
        <Logo />
      </div>

      <SectionLabel>Practice</SectionLabel>
      <nav className="flex flex-col gap-0.5" aria-label="Main">
        <NavItem to="/" end icon={<HomeIcon width={19} height={19} />} label="Home" onNavigate={onNavigate} />
        <NavItem to="/reading" icon={<BookIcon width={19} height={19} />} label="Reading" onNavigate={onNavigate} />
        <NavItem to="/listening" icon={<HeadphonesIcon width={19} height={19} />} label="Listening" onNavigate={onNavigate} />
        <SoonItem icon={<PenIcon width={19} height={19} />} label="Writing" />
        <SoonItem icon={<MicIcon width={19} height={19} />} label="Speaking" />
        {/* Model Writing/Speaking answers — fills the gap until those papers ship. */}
        <NavItem to="/samples" icon={<StarIcon width={19} height={19} />} label="Samples" onNavigate={onNavigate} />
      </nav>

      <div className="mt-4">
        <SectionLabel>Account</SectionLabel>
        <nav className="flex flex-col gap-0.5" aria-label="Account">
          {session && (
            <NavItem
              to="/dashboard"
              icon={<ChartIcon width={19} height={19} />}
              label="My results"
              onNavigate={onNavigate}
            />
          )}
          <NavItem
            to="/pricing"
            icon={<DollarIcon width={19} height={19} />}
            label="Pricing"
            onNavigate={onNavigate}
          />
        </nav>
      </div>

      <div className="mt-auto space-y-2.5 pt-4">
        {/* Full mock test card: the WHOLE 4-skill CEFR exam (Reading ·
            Listening · Writing · Speaking), not just Reading. Stats describe
            the full test; sleeping cat rests on the card's bottom edge. */}
        <div className="overflow-hidden rounded-2xl bg-brand-soft px-4 pb-0 pt-3">
          <p className="text-sm font-extrabold text-brand-deep">Full mock test</p>
          <div className="mt-2 flex gap-6">
            <MockStat num="4" label="Sections" />
            <MockStat num="3h" label="Duration" />
            <MockStat num="B1–C1" label="Levels" />
          </div>
          <img
            src="/cat-cushion.png"
            alt=""
            aria-hidden
            draggable={false}
            className="pointer-events-none mx-auto -mb-1 mt-1.5 h-24 w-auto translate-x-3 select-none"
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
  ['/pricing', 'Pricing'],
  ['/support', 'Support'],
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
          : p.startsWith('/pricing')
            ? DollarIcon
            : p.startsWith('/support')
              ? LifebuoyIcon
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
                        <Link
                          to="/support"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-ink hover:bg-page"
                        >
                          <LifebuoyIcon width={16} height={16} />
                          Support
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
