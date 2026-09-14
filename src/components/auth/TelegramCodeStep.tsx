import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react'
import qrcode from 'qrcode-generator'
import { fetchTelegramStatus, TelegramExpiredError, type TelegramStart } from '../../lib/phoneAuth'

/** Telegram's official brand blue — the one raw hex on this screen, like
 *  Google's colours were on the old sign-in button. */
const TELEGRAM_BLUE = '#2AABEE'

export function TelegramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M21.94 4.3 18.7 19.58c-.24 1.08-.88 1.35-1.79.84l-4.94-3.64-2.38 2.3c-.26.26-.49.48-1 .48l.36-5.03 9.16-8.28c.4-.36-.09-.55-.62-.2L6.16 13.2l-4.87-1.52c-1.06-.33-1.08-1.06.22-1.57L20.54 2.8c.88-.33 1.65.2 1.4 1.5Z" />
    </svg>
  )
}

/** "Enter the code" (design: Kodni kiriting). Shows the bot link + QR, six code
 *  boxes and the request's countdown. The parent owns what happens with the
 *  code (`onVerify`) and may put extra fields above the button (reset uses it
 *  for the new password). */
export function TelegramCodeStep({
  start,
  title,
  intro,
  confirmLabel,
  onVerify,
  onRestart,
  children,
}: {
  start: TelegramStart
  title: string
  intro: string
  confirmLabel: string
  onVerify: (code: string) => Promise<void>
  onRestart: () => void
  children?: ReactNode
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [phone, setPhone] = useState<string | null>(null)
  const [codeSent, setCodeSent] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  const secondsLeft = Math.max(0, Math.floor((new Date(start.expiresAt).getTime() - now) / 1000))

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (secondsLeft === 0) setExpired(true)
  }, [secondsLeft])

  // Watch for the bot sending the code, so the screen can say where it went.
  useEffect(() => {
    if (expired) return
    let stop = false
    const tick = async () => {
      try {
        const s = await fetchTelegramStatus(start.token)
        if (stop) return
        setPhone(s.phone)
        setCodeSent(s.codeSent)
        if (s.expired) setExpired(true)
      } catch {
        // a missed poll is harmless
      }
    }
    void tick()
    const t = window.setInterval(tick, codeSent ? 15000 : 3000)
    return () => {
      stop = true
      window.clearInterval(t)
    }
  }, [start.token, expired, codeSent])

  const qrSvg = useMemo(() => {
    const qr = qrcode(0, 'M')
    qr.addData(start.botUrl)
    qr.make()
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true })
  }, [start.botUrl])

  function setDigit(i: number, value: string) {
    const d = value.replace(/\D/g, '')
    if (!d) {
      setDigits((prev) => prev.map((v, j) => (j === i ? '' : v)))
      return
    }
    // Typing (or autofill) may deliver several digits at once: spread them.
    setDigits((prev) => {
      const next = [...prev]
      for (let k = 0; k < d.length && i + k < 6; k++) next[i + k] = d[k]
      return next
    })
    boxes.current[Math.min(i + d.length, 5)]?.focus()
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus()
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>) {
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!d) return
    e.preventDefault()
    setDigits(Array.from({ length: 6 }, (_, k) => d[k] ?? ''))
    boxes.current[Math.min(d.length, 5)]?.focus()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const code = digits.join('')
    if (code.length !== 6) {
      setError('Enter all 6 digits from the bot.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onVerify(code)
    } catch (err) {
      if (err instanceof TelegramExpiredError) setExpired(true)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  if (expired) {
    return (
      <div className="mt-6 flex flex-col items-center text-center">
        <h1 className="text-[28px] font-black leading-[1.15] text-heading">Time’s up</h1>
        <p className="mt-2 text-[15px] font-semibold text-ink-soft">
          This request has expired or was already used. Start again to get a new code.
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-6 w-full rounded-xl bg-brand px-4 py-[15px] text-base font-extrabold text-white transition-colors hover:bg-brand-deep"
        >
          Start over
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col items-center text-center">
      <span
        className="mt-6 grid h-16 w-16 place-items-center rounded-full text-white lg:mt-0"
        style={{ background: TELEGRAM_BLUE }}
      >
        <TelegramIcon size={30} />
      </span>
      <h1 className="mt-4 text-[28px] font-black leading-[1.15] text-heading">{title}</h1>
      <p className="mt-2 text-[15px] font-semibold leading-[1.45] text-ink-soft">{intro}</p>

      <a
        href={start.botUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-[14px] text-base font-extrabold text-white no-underline shadow-[0_8px_20px_rgba(42,171,238,0.28)] transition-[filter] hover:brightness-95"
        style={{ background: TELEGRAM_BLUE }}
      >
        <TelegramIcon />
        Open Telegram bot
      </a>

      <div
        className="mt-4 h-36 w-36 rounded-xl border border-line bg-white p-2.5 [&>svg]:h-full [&>svg]:w-full"
        aria-label="QR code that opens the Telegram bot"
        role="img"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
      <p className="mt-2 text-xs font-semibold text-ink-soft">or scan the QR code with your phone</p>

      <p
        role="status"
        className={`mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold ${
          codeSent ? 'bg-emerald-50 text-emerald-800' : 'bg-brand-soft text-brand-deep'
        }`}
      >
        {codeSent && phone
          ? `Code sent to ${phone} in Telegram.`
          : 'In the bot, press Start, then 📱 Send my number.'}
      </p>

      <div className="mt-5 flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="6-digit code">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              boxes.current[i] = el
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            aria-label={`Digit ${i + 1}`}
            className="tnum h-14 w-11 rounded-xl border-2 border-line bg-page text-center text-2xl font-extrabold text-heading outline-none transition-[border-color,box-shadow] focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_13%,transparent)] sm:w-12"
          />
        ))}
      </div>

      {children && <div className="mt-5 w-full text-left">{children}</div>}

      {error && (
        <p
          role="alert"
          className="mt-4 w-full rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-xl border-0 bg-brand px-4 py-[15px] text-base font-extrabold text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--color-brand)_22%,transparent)] transition-[background,transform] duration-150 hover:bg-brand-deep active:translate-y-px disabled:opacity-60"
      >
        {busy ? 'Checking…' : confirmLabel}
      </button>

      <p className="mt-4 text-sm font-semibold text-ink-soft">
        Didn’t get a code? Press 📱 in the bot again.
      </p>
      <p className="tnum mt-2 text-xs font-semibold text-ink-soft">
        Time left to finish: {mm}:{ss}
      </p>
      <button
        type="button"
        onClick={onRestart}
        className="mt-2 border-0 bg-transparent p-1 text-sm font-extrabold text-brand underline-offset-2 hover:underline"
      >
        Start over
      </button>
    </form>
  )
}
