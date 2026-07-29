import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckIcon, CloseIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { COMMUNITY_URL } from '../components/Layout'
import type { PlanId } from '../types/plan'

// Owner-set tiers (from the Pricing design, 2026-07-10). Prices are in so'm.
// The paid plans are real buttons; the checkout link isn't wired yet — set
// `checkoutUrl` on a plan (Payme/Click/Stripe/Telegram bot) and it renders as a
// real link instead of a placeholder button. Reading & Listening practice is
// free today; the per-plan limits are future-state until billing is enforced.
type Feature = { lead?: string; text: string; note?: string; excluded?: boolean }

type Plan = {
  id: PlanId
  name: string
  price: string
  unit?: string
  period: string
  features: Feature[]
  recommended?: boolean
  cta: {
    label: string
    helper: string
    variant: 'secondary' | 'primary' | 'dark'
    /** Internal route (Free → start practising). */
    to?: string
    /** External checkout URL for a paid plan — drop it in to wire payment. */
    checkoutUrl?: string
  }
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 'Free',
    period: 'forever',
    features: [
      { text: 'Unlimited free practice tests' },
      { text: 'Instant CEFR band' },
      { text: 'Every free test, any time' },
      { text: 'No card needed' },
      { text: 'Premium mock tests (Pro & Premium)', excluded: true },
    ],
    cta: { label: 'Continue free', helper: 'No card needed', variant: 'secondary', to: '/reading' },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '75 000',
    unit: "so'm",
    period: 'per month',
    recommended: true,
    features: [
      { lead: '5', text: 'full mock tests', note: '/mo' },
      { text: 'Unlimited Reading sets' },
      { text: 'Unlimited Listening sets' },
      { lead: '10', text: 'Writing checks', note: '/mo' },
      { lead: '10', text: 'Speaking checks', note: '/mo' },
      { text: 'Instant CEFR band' },
    ],
    cta: {
      label: 'Upgrade to Pro',
      helper: 'Contact us on Telegram to upgrade',
      variant: 'primary',
      // TODO: paste the Pro checkout link here to make the button go straight to
      // checkout. While empty, the CTA opens Telegram (manual upgrade → an admin
      // grants the plan in /admin/users).
      checkoutUrl: '',
    },
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '100 000',
    unit: "so'm",
    period: 'per month',
    features: [
      { text: 'Unlimited full mock tests' },
      { text: 'Unlimited Reading sets' },
      { text: 'Unlimited Listening sets' },
      { text: 'Unlimited Writing checks' },
      { text: 'Unlimited Speaking checks' },
      { text: 'Instant CEFR band' },
    ],
    cta: {
      label: 'Get Premium',
      helper: 'Contact us on Telegram to upgrade',
      variant: 'dark',
      // TODO: paste the Premium checkout link here to make the button go straight
      // to checkout. While empty, the CTA opens Telegram (manual upgrade → an
      // admin grants the plan in /admin/users).
      checkoutUrl: '',
    },
  },
]

const CTA_VARIANT: Record<Plan['cta']['variant'], string> = {
  secondary: 'border border-line bg-white text-brand hover:bg-brand-soft',
  primary: 'bg-brand text-white hover:bg-brand-deep',
  dark: 'bg-heading text-white hover:opacity-90',
}

function FeatureRow({ lead, text, note, excluded }: Feature) {
  return (
    <div className="flex items-start gap-3.5">
      {excluded ? (
        <CloseIcon width={21} height={21} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ink-faint" />
      ) : (
        <CheckIcon width={21} height={21} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok" />
      )}
      <span className={`text-base font-bold ${excluded ? 'text-ink-faint' : 'text-ink'}`}>
        {lead && <strong className="font-extrabold text-heading">{lead} </strong>}
        {text}
        {note && <span className="font-bold text-ink-soft"> {note}</span>}
      </span>
    </div>
  )
}

function PlanCta({ cta, current }: { cta: Plan['cta']; current: boolean }) {
  const cls = `flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-base font-bold transition-colors ${CTA_VARIANT[cta.variant]}`
  // The plan the student is already on: no action to take.
  if (current) {
    return (
      <div className="flex w-full items-center justify-center rounded-xl border border-brand bg-brand-soft px-6 py-3.5 text-base font-bold text-brand">
        Current plan
      </div>
    )
  }
  // Internal route (Free) → Link. A wired checkout URL → external checkout.
  // Until billing exists, a paid plan sends the student to Telegram to upgrade
  // manually (an admin then grants the plan) — see CLAUDE.md subscription notes.
  if (cta.to) {
    return (
      <Link to={cta.to} className={cls}>
        {cta.label}
      </Link>
    )
  }
  const href = cta.checkoutUrl || COMMUNITY_URL
  const external = !cta.checkoutUrl // Telegram fallback opens in a new tab
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={cls}
    >
      {cta.label}
    </a>
  )
}

function PlanCard({
  plan,
  selected,
  current,
  onSelect,
}: {
  plan: Plan
  selected: boolean
  current: boolean
  onSelect: () => void
}) {
  const isFree = plan.id === 'free'
  return (
    <div
      role="radio"
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`relative flex h-full cursor-pointer flex-col rounded-2xl border bg-white p-6 shadow-card transition-colors ${
        selected
          ? 'border-brand ring-2 ring-inset ring-brand'
          : 'border-line hover:border-ink-faint'
      }`}
    >
      <div className="flex h-7 items-center justify-between">
        <span
          className={`text-[13px] font-extrabold uppercase tracking-[0.14em] ${
            isFree ? 'text-ink-soft' : 'text-brand'
          }`}
        >
          {plan.name}
        </span>
        {current ? (
          <span className="rounded-full bg-brand px-3 py-1 text-xs font-extrabold text-white">
            Your plan
          </span>
        ) : (
          plan.recommended && (
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold text-brand">
              Recommended
            </span>
          )
        )}
      </div>

      <div className="mt-3.5 flex items-baseline gap-1.5">
        <span className="text-[40px] font-extrabold leading-none text-heading">{plan.price}</span>
        {plan.unit && <span className="text-base font-extrabold text-ink-soft">{plan.unit}</span>}
      </div>
      <p className="mt-1.5 text-base font-bold text-ink-soft">{plan.period}</p>

      <div className="my-5 border-t border-line" />

      <div className="flex flex-col gap-3">
        {plan.features.map((f) => (
          <FeatureRow key={f.text} {...f} />
        ))}
      </div>

      <div className="mt-auto pt-6">
        <PlanCta cta={plan.cta} current={current} />
        <p className="mt-2.5 text-center text-sm font-semibold text-ink-soft">
          {current ? 'You’re on this plan' : plan.cta.helper}
        </p>
      </div>
    </div>
  )
}

export function PricingPage() {
  const { session, plan: currentPlan } = useAuth()
  // The ring follows the student's pick rather than being nailed to Pro. Pro
  // starts selected because it's the recommended plan; the "Recommended" pill
  // is a property of the plan, so it stays put as the ring moves.
  const [selected, setSelected] = useState<Plan['id']>('pro')
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Pricing</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Start free. Upgrade when you’re ready for full exam prep — cancel anytime. Free allowances
          refresh every month.
        </p>
      </div>

      {/* Plans */}
      <div
        role="radiogroup"
        aria-label="Plans"
        className="grid gap-6 md:grid-cols-3 md:items-stretch"
      >
        {PLANS.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selected={selected === plan.id}
            // Only show "Your plan" to signed-in students on their actual tier.
            current={!!session && currentPlan === plan.id}
            onSelect={() => setSelected(plan.id)}
          />
        ))}
      </div>
    </div>
  )
}
