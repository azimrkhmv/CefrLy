import { formatPhone, isPhoneLoginEmail } from './phoneAuth'
import type { PlanId } from '../types/plan'

// ---------------------------------------------------------------------------
// The upgrade request a student sends to the admin on Telegram.
//
// There is no checkout. A student pays by card transfer and the admin grants
// the plan by hand in /admin/users, so the ONE thing that makes this workable is
// that the admin can tell, from the message alone, WHO paid and for WHAT. The
// student never has to type any of it: the button opens Telegram with the whole
// message already written, and they press send.
//
// Bilingual on purpose — Uzbek first (the students), English under it (so the
// same text is readable by anyone helping out on the account).
//
// The card number is NOT a secret. It is the number people pay INTO, it is
// printed in every one of these messages, and it lives in the shipped bundle by
// design. Never put anything here that actually needs protecting.
// ---------------------------------------------------------------------------

export const PAYMENT_CARD = '5614 6824 1850 4058'
export const PAYMENT_CARD_HOLDER = 'AZIMBEK RAHIMOV'
export const PAYMENT_METHOD = 'UZCARD'

/** Plan names exactly as the pricing page shows them, with their price. */
const PLAN_ORDER: Record<Exclude<PlanId, 'free'>, { name: string; price: string }> = {
  pro: { name: 'Pro', price: "75 000 so'm" },
  premium: { name: 'Premium', price: "100 000 so'm" },
}

/** How the admin finds the account in /admin/users. The phone IS the login, so
 *  it is the best handle; a Google-era or hand-made account falls back to the
 *  email, and a session with neither falls back to the user id. */
export function accountRef(user: { email?: string; id: string } | null | undefined): string {
  if (!user) return '—'
  if (isPhoneLoginEmail(user.email)) return formatPhone(user.email!.split('@')[0])
  return user.email || user.id
}

/** The message body, bilingual, ready to send. */
export function upgradeMessage(plan: Exclude<PlanId, 'free'>, ref: string): string {
  const { name, price } = PLAN_ORDER[plan]
  return [
    `Assalomu alaykum, men ${name} tarifini (${price}) sotib olmoqchiman.`,
    `To'lov usuli: ${PAYMENT_METHOD}`,
    `Karta: ${PAYMENT_CARD} (${PAYMENT_CARD_HOLDER})`,
    `To'lovni amalga oshirgach, chekni shu yerga yuboraman.`,
    `Mening akkauntim: ${ref}`,
    ``,
    `Hello, I would like to buy the ${name} plan (${price}).`,
    `Payment method: ${PAYMENT_METHOD}`,
    `Card: ${PAYMENT_CARD} (${PAYMENT_CARD_HOLDER})`,
    `I will send the receipt here once I have paid.`,
    `My account: ${ref}`,
  ].join('\n')
}

/** A t.me link that opens the admin chat with the message already typed. */
export function upgradeTelegramUrl(
  adminUrl: string,
  plan: Exclude<PlanId, 'free'>,
  ref: string,
): string {
  return `${adminUrl}?text=${encodeURIComponent(upgradeMessage(plan, ref))}`
}
