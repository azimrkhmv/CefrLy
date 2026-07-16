import { Link } from 'react-router-dom'
import { CheckIcon } from '../components/icons'

// Owner-set tiers (from the Pricing design, 2026-07-10). Prices are in so'm.
// The paid plans are real buttons; the checkout link isn't wired yet — set
// `checkoutUrl` on a plan (Payme/Click/Stripe/Telegram bot) and it renders as a
// real link instead of a placeholder button. Reading & Listening practice is
// free today; the per-plan limits are future-state until billing is enforced.
type Feature = { lead?: string; text: string; note?: string }

type Plan = {
  id: 'free' | 'pro' | 'premium'
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
      { lead: '1', text: 'full mock test' },
      { lead: '2', text: 'Reading sets' },
      { lead: '2', text: 'Listening sets' },
      { lead: '1', text: 'Writing check' },
      { lead: '1', text: 'Speaking check' },
      { text: 'Instant CEFR band' },
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
      helper: 'Billed monthly · cancel anytime',
      variant: 'primary',
      // TODO: paste the Pro checkout link here to make the button go live.
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
      helper: 'Billed monthly · cancel anytime',
      variant: 'dark',
      // TODO: paste the Premium checkout link here to make the button go live.
      checkoutUrl: '',
    },
  },
]

const CTA_VARIANT: Record<Plan['cta']['variant'], string> = {
  secondary: 'border border-line bg-white text-brand hover:bg-brand-soft',
  primary: 'bg-brand text-white hover:bg-brand-deep',
  dark: 'bg-heading text-white hover:opacity-90',
}

function FeatureRow({ lead, text, note }: Feature) {
  return (
    <div className="flex items-start gap-3">
      <CheckIcon width={18} height={18} strokeWidth={2.4} className="mt-0.5 shrink-0 text-ok" />
      <span className="text-sm font-bold text-ink">
        {lead && <strong className="font-extrabold text-heading">{lead} </strong>}
        {text}
        {note && <span className="font-bold text-ink-soft"> {note}</span>}
      </span>
    </div>
  )
}

function PlanCta({ cta }: { cta: Plan['cta'] }) {
  const cls = `flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-bold transition-colors ${CTA_VARIANT[cta.variant]}`
  // Internal route (Free) → Link; a wired checkout URL → external link; until a
  // paid plan's link is pasted in, it's a plain (real) button ready to connect.
  if (cta.to) {
    return (
      <Link to={cta.to} className={cls}>
        {cta.label}
      </Link>
    )
  }
  if (cta.checkoutUrl) {
    return (
      <a href={cta.checkoutUrl} className={cls}>
        {cta.label}
      </a>
    )
  }
  return (
    <button type="button" className={cls}>
      {cta.label}
    </button>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const isFree = plan.id === 'free'
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border border-line bg-white p-5 shadow-card ${
        plan.recommended ? 'ring-2 ring-inset ring-brand' : ''
      }`}
    >
      <div className="flex h-6 items-center justify-between">
        <span
          className={`text-xs font-extrabold uppercase tracking-[0.14em] ${
            isFree ? 'text-ink-soft' : 'text-brand'
          }`}
        >
          {plan.name}
        </span>
        {plan.recommended && (
          <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-extrabold text-brand">
            Recommended
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[34px] font-extrabold leading-none text-heading">{plan.price}</span>
        {plan.unit && <span className="text-sm font-extrabold text-ink-soft">{plan.unit}</span>}
      </div>
      <p className="mt-1 text-sm font-bold text-ink-soft">{plan.period}</p>

      <div className="my-4 border-t border-line" />

      <div className="flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <FeatureRow key={f.text} {...f} />
        ))}
      </div>

      <div className="mt-auto pt-5">
        <PlanCta cta={plan.cta} />
        <p className="mt-2 text-center text-xs font-semibold text-ink-soft">{plan.cta.helper}</p>
      </div>
    </div>
  )
}

export function PricingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-heading">Pricing</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
          Start free. Upgrade when you’re ready for full exam prep — cancel anytime.
        </p>
      </div>

      {/* Plans */}
      <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  )
}
