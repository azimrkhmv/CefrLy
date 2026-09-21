import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ADMIN_URL, COMMUNITY_URL } from '../components/Layout'
import { LifebuoyIcon, UsersIcon } from '../components/icons'

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
        No. Reopen the test — on this device or another one — and you’ll get a Resume banner. Your
        answers are saved as you type. Only the Exit button cancels an attempt (it asks you to
        confirm first).
      </>
    ),
  },
  {
    q: 'How are Writing and Speaking marked?',
    a: (
      <>
        An AI examiner marks them against the official CEFR (multilevel) criteria and gives you a
        score out of 75 with feedback. Like every band on Cefrly it’s an estimate. If a mark looks
        wrong, use “Ask for a recheck” on a Speaking result or message us, and we’ll look at it.
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

      {/* TWO doors, in this order on purpose. A support request is often about
          the student's own marks or payment, which does not belong in a channel
          other learners read — so the private one leads. */}
      <section className="max-w-xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-7">
        <h2 className="text-base font-extrabold text-heading">Message us directly</h2>
        <p className="mt-1 text-sm text-ink-soft">
          A problem with your score, your plan or a payment goes straight to the team on Telegram.
          Private — nobody else sees it.
        </p>
        <a
          href={ADMIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-deep"
        >
          <LifebuoyIcon width={17} height={17} />
          Contact support
        </a>
      </section>

      <section className="max-w-xl rounded-2xl border border-line bg-white p-6 shadow-card sm:p-7">
        <h2 className="text-base font-extrabold text-heading">Join the community</h2>
        <p className="mt-1 text-sm text-ink-soft">
          The CEFR Community channel is where learners preparing for the same exam swap tips and
          study together.
        </p>
        <a
          href={COMMUNITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:border-ink-faint"
        >
          <UsersIcon width={17} height={17} />
          Open the channel
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

      <p className="max-w-xl text-xs text-ink-soft">
        <Link to="/terms" className="font-bold text-brand hover:underline">
          Terms of Use
        </Link>{' '}
        ·{' '}
        <Link to="/privacy" className="font-bold text-brand hover:underline">
          Privacy Policy
        </Link>
      </p>
    </div>
  )
}
