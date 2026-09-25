import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from './Logo'

// Chrome for the public legal pages (/terms, /privacy). They sit OUTSIDE the
// app shell and outside ProtectedRoute: the sign-up screen links to them, so a
// visitor with no account must be able to read them.
export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string
  /** Human date the text last changed, e.g. "21 September 2026". */
  updated: string
  intro: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-white/70 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/terms" className="font-bold text-brand hover:underline">
              Terms
            </Link>
            <Link to="/privacy" className="font-bold text-brand hover:underline">
              Privacy
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <article className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-10">
          <h1 className="text-2xl font-extrabold text-heading sm:text-3xl">{title}</h1>
          <p className="mt-1 text-xs font-bold text-ink-soft">Last updated {updated}</p>
          <div className="mt-5 text-sm leading-relaxed text-ink">{intro}</div>
          <div className="mt-8 space-y-8">{children}</div>
        </article>
      </main>
    </div>
  )
}

/** One numbered section of a legal page. */
export function LegalSection({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="text-base font-extrabold text-heading">
        {n}. {title}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  )
}
