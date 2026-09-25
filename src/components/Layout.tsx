import { Suspense, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { RouteFallback } from './RouteFallback'
import { useAuth } from '../lib/auth'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { Logo } from './Logo'
import { SHOW_WRITING } from '../lib/features'
import { formatPhone, isPhoneLoginEmail } from '../lib/phoneAuth'
import { NavDrawerContext } from './navDrawer'
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

// TWO DIFFERENT TELEGRAM DESTINATIONS — do not collapse them into one.
//
// COMMUNITY_URL is the PUBLIC channel: other learners can read it. It is for
// the "Join CEFR Community" CTA and nothing else.
//
// ADMIN_URL is the super_admin's OWN account. Anything a student would not want
// posted in front of other learners goes here: support requests, bug reports,
// a challenge to a mark, and upgrade requests (the admin grants the plan by
// hand, so the student has to reach a person, not a group).
export const COMMUNITY_URL = 'https://t.me/cefrly'
export const ADMIN_URL = 'https://t.me/cefr_qabul'

// Glass sidebar (owner design 2026-09-24): quiet rows; the active row is a
// frosted white pill with its icon seated in a white disc. No left rail (the
// 3px brand bar was removed on the owner's call, 2026-09-25).
const navItemBase =
  'group relative flex items-center gap-3 rounded-2xl py-1.5 text-sm font-bold transition-colors'

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
            ? 'bg-white/70 pl-3 pr-3 text-brand shadow-card'
            : 'px-3 text-ink-soft hover:bg-white/45'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* ink-soft, not ink-faint — ink-faint is 2.0:1 and misses even the
              3:1 non-text contrast minimum for icons. */}
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
              isActive ? 'bg-white text-brand shadow-card' : 'text-ink-soft group-hover:text-ink'
            }`}
          >
            {icon}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
      {children}
    </p>
  )
}

function MockStat({ num, label }: { num: string; label: string }) {
  return (
    <div>
      <div className="text-[17px] font-extrabold tabular-nums leading-none text-brand">{num}</div>
      {/* brand-deep, not ink-soft: ink-soft on the card's brand-soft fill is
          4.3:1, just under WCAG AA for this 9.5px label. */}
      <div className="mt-1 text-[9.5px] font-bold uppercase tracking-wide text-brand-deep">
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
        {SHOW_WRITING && (
          <NavItem to="/writing" icon={<PenIcon width={19} height={19} />} label="Writing" onNavigate={onNavigate} />
        )}
        <NavItem to="/speaking" icon={<MicIcon width={19} height={19} />} label="Speaking" onNavigate={onNavigate} />
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
        <div className="overflow-hidden rounded-2xl bg-white/55 px-4 pb-0 pt-3 ring-1 ring-white/80">
          <p className="text-sm font-extrabold text-brand-deep">Full mock test</p>
          <div className="mt-2 flex gap-6">
            <MockStat num="4" label="Sections" />
            <MockStat num="3h" label="Duration" />
            <MockStat num="B1–C2" label="Levels" />
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
          // accent-deep, not accent: white on --color-accent is 4.2:1 and fails
          // WCAG AA for 14px text. accent-deep is 5.7:1 and reads the same.
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-accent-deep to-brand px-4 py-3 text-sm font-bold text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--color-brand)_25%,transparent)] transition-[filter] hover:brightness-110"
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
  ['/writing', 'Writing'],
  ['/speaking', 'Speaking'],
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

  const navDrawer = useMemo(() => ({ open: () => setDrawerOpen(true) }), [])

  const pageTitle =
    PAGE_TITLES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] ?? 'Home'
  const p = location.pathname
  const PageIcon = p.startsWith('/reading')
    ? BookIcon
    : p.startsWith('/listening')
      ? HeadphonesIcon
      : p.startsWith('/writing')
        ? PenIcon
        : p.startsWith('/speaking')
        ? MicIcon
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
    <NavDrawerContext.Provider value={navDrawer}>
    {/* The waves background comes from body::before (index.css). */}
    <div className="min-h-screen text-ink">
      {!isSupabaseConfigured && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          Supabase is not configured — copy <code className="font-mono">.env.example</code> to{' '}
          <code className="font-mono">.env</code> and fill in your project keys (see README).
        </div>
      )}

      {/* Desktop sidebar */}
      {/* Frosted glass, flush to the top, bottom and left edges of the window
          (owner call: one connected rail, not a floating card). */}
      <aside className="app-glass app-glass-rail fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <SidebarContent />
      </aside>

      {/* Section-menu drawer: the header button on small screens, the Home
          "Start a test" CTA at any width. */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40">
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
        {/* Phones: a light blur band, so content scrolling under the menu
            button stays legible. Desktop: fully clear (a band drew a visible
            strip across the art); the title and avatar pills carry their own
            frosted fill. */}
        <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--color-page)_35%,transparent)] backdrop-blur-md lg:bg-transparent lg:backdrop-blur-none">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button
              onClick={() => setDrawerOpen(true)}
              className="inline-flex items-center justify-center rounded-xl border border-line bg-white p-2.5 text-brand shadow-card transition-colors hover:border-ink-faint hover:bg-brand-soft lg:hidden"
              aria-label="Open menu"
            >
              <MenuIcon width={22} height={22} />
            </button>
            <span className="inline-flex items-center gap-2 text-base font-extrabold text-heading lg:rounded-full lg:bg-white/75 lg:px-4 lg:py-2 lg:text-sm lg:font-bold lg:shadow-card lg:ring-1 lg:ring-white/80">
              <PageIcon width={15} height={15} className="hidden text-brand lg:block" />
              {pageTitle}
            </span>
            <div className="ml-auto flex items-center">
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setMenuOpen((v) => !v)}
                    className="flex items-center gap-1 rounded-full bg-white/75 py-1 pl-1 pr-2 shadow-card ring-1 ring-white/80 transition-transform hover:scale-[1.03]"
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
                          {isPhoneLoginEmail(session.user.email)
                            ? formatPhone(session.user.email!.split('@')[0])
                            : session.user.email}
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
          // Less top padding than bottom: the sticky header already gives the
          // page its top breathing room, so a big pt just wasted space above
          // every page's heading (pushed content out of view).
          className="page-enter mx-auto max-w-6xl px-4 pb-10 pt-3 sm:px-8 sm:pb-12 sm:pt-4"
        >
          {/* Route components are lazy (App.tsx). Boundary sits here, inside
              <main>, so the sidebar/header never unmount while a chunk loads. */}
          <Suspense fallback={<RouteFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
    </NavDrawerContext.Provider>
  )
}
