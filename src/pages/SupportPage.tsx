import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { COMMUNITY_URL } from '../components/Layout'
import { UsersIcon } from '../components/icons'

const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'How is my CEFR band estimated?',
    a: (
      <>
        Each paper has 35 questions worth 1 mark each. 28+ correct maps to C1, 18–27 to B2 and
        10–17 to B1. It’s an indicative band per skill — a solid signal of where you stand, not an
        official certificate.
      </>
    ),
  },
  {
    q: 'What’s the difference between Practice and Simulation?',
    a: (
      <>
        Simulation follows real exam rules: fixed timing and locked audio with limited plays.
        Practice is for training — pause the clock, choose your own reading duration, and replay
        or scrub the listening audio as much as you like.
      </>
    ),
  },
  {
    q: 'I closed the tab mid-test — is my attempt lost?',
    a: (
      <>
        No. Reopen the test on the same device and browser and you’ll get a Resume banner — your
        answers are saved as you type. Only the Exit button cancels an attempt (it asks you to
        confirm first).
      </>
    ),
  },
  {
    q: 'When are Writing and Speaking coming?',
    a: (
      <>
        They’re in the works. Until then, study the model answers on the{' '}
        <Link to="/samples" className="font-bold text-brand hover:underline">
          Samples
        </Link>{' '}
        page to see what a strong response looks like.
      </>
    ),
  },
]

export function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Support</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-soft">
          Stuck on something, found a bug, or have an idea? We answer fast.
        </p>
      </div>

      <section className="max-w-xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-7">
        <h2 className="text-base font-extrabold text-heading">Talk to us on Telegram</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The CEFR Community is the fastest way to reach the team — and to swap tips with other
          learners preparing for the same exam.
        </p>
        <a
          href={COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
        >
          <UsersIcon width={17} height={17} />
          Join the community
        </a>
      </section>

      <section className="max-w-xl space-y-3">
        <h2 className="text-base font-extrabold text-heading">Common questions</h2>
        {FAQ.map(({ q, a }) => (
          <div key={q} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <h3 className="text-sm font-extrabold text-heading">{q}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{a}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
