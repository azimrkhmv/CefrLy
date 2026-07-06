import { Link } from 'react-router-dom'
import { ArrowRightIcon, CheckIcon } from '../components/icons'

// No billing exists yet: pricing is honest about early access being free.
// When paid plans arrive, this page grows real tiers — don't invent numbers.
const INCLUDED = [
  'Full Reading mock tests — 35 questions, real exam structure',
  'Full Listening mock tests with authentic audio',
  'Practice mode: pause, pick your timing, replay audio freely',
  'Simulation mode: strict real-exam rules',
  'Instant indicative CEFR band with detailed analysis',
  'Listening review with audio, transcript and answer keys',
  'Model Writing & Speaking answers to study',
]

export function PricingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Pricing</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Simple while we grow: everything on Cefrly is free during early access.
        </p>
      </div>

      <section className="max-w-xl rounded-2xl border border-line bg-white p-7 shadow-card sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              Early access
            </p>
            <p className="mt-1 text-[40px] font-extrabold leading-none text-heading">Free</p>
          </div>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
            Everything included
          </span>
        </div>

        <ul className="mt-6 space-y-2.5">
          {INCLUDED.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-sm text-ink">
              <CheckIcon width={16} height={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-ok" />
              {line}
            </li>
          ))}
        </ul>

        <Link
          to="/reading"
          className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-deep"
        >
          Start a free mock test
          <ArrowRightIcon width={16} height={16} />
        </Link>
      </section>

      <p className="max-w-xl text-sm text-ink-soft">
        Paid plans will arrive together with new features — we’ll announce any changes in the
        community first, well before they happen.
      </p>
    </div>
  )
}
