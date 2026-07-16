import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { consumeSessionExpired } from '../lib/sessionExpiry'
import { CozyScene } from '../components/CozyScene'

// Mascot alternatives — one picked at random per page load, so different
// visitors meet a different cat. Each asset has its OWN crop/aspect, so each
// cat carries its own `frame` (size + anchor of the mascot box); one shared
// frame can't fit both a square cushion cat and a wide peek crop.
//
// To add another alternative: drop the PNG in /public and append an entry
// with its own `key`, `frame`, and personality copy. Preview any one by name
// with ?cat=<key> (e.g. /login?cat=surprised) — see catIndex below.
type CatDef = {
  key: string
  src: string
  alt: string
  sleepy: boolean
  frame: string // Tailwind sizing/anchor for the mascot box (the poke button).
  /** Tailwind position of the floating-zzz overlay, so the z's rise from THIS
   *  cat's head (defaults to the curled sleeper's spot). */
  zzzPos?: string
  hello: string
  helloSignup: string
  peek: string
  bye: string
  quips: string[]
}

const CATS: CatDef[] = [
  {
    key: 'sleeping',
    src: '/cat-sleeping.png',
    alt: 'A sleepy grey cat curled up on a lavender cushion',
    sleepy: true,
    // 1065×700 full-cushion cat (grey, matching the band-cat art); baked z's
    // erased — the animated overlay owns the zzz's. Sits low-left with room to
    // breathe. Frame is SHORTER than the other cats': this art is a wide, low
    // composition, so at the shared 300px it rendered visibly bigger — 245px
    // brings its cushion mass in line (user call 2026-07-06).
    frame: 'h-[clamp(190px,27vh,245px)] max-w-[480px]',
    zzzPos: 'left-[42%] top-[56px]',
    hello: 'Oh, you again. Welcome back.',
    helloSignup: 'A new student? Fine, I’m up…',
    peek: 'I’m not peeking. Promise. Zzz.',
    bye: 'Go ahead. I’ll guard the bed.',
    quips: [
      'I was awake the whole time.',
      'Five more minutes. Then grammar.',
      'Petting is not on the syllabus.',
      'This is my study position.',
      'I dream in perfect English.',
    ],
  },
  {
    key: 'surprised',
    src: '/cat-surprised.png',
    alt: 'A round grey cat sitting wide-eyed on a lavender cushion',
    sleepy: false,
    // Full-body cushion cat (public/cat-surprised.png), composed like the
    // sleeping one — same frame, so both alternatives sit identically.
    frame: 'h-[clamp(230px,33vh,300px)] max-w-[480px]',
    // Copy verbatim from the source design ("Cefrly Welcome") — a smug,
    // well-fed cat that pretends nothing surprises it.
    hello: 'Oh! You startled me. Welcome back.',
    helloSignup: 'A new student? I’m all eyes.',
    peek: 'I saw that. I see everything.',
    bye: 'Go on. I’ll be watching. Closely.',
    quips: [
      'I have simply eaten the reading paper.',
      'I am not fat. I am well-read.',
      'Who said that? ...Oh. You.',
      'I’m deeply invested in your progress.',
      'Blink twice if you brought snacks.',
    ],
  },
  {
    key: 'flop',
    src: '/cat-flop.png',
    alt: 'A chubby grey cat asleep on its back on a lavender cushion',
    sleepy: true,
    // 917×700 belly-up flop sleeper on its cushion (grey, matching the band-cat
    // art); its baked z's were erased — the animated overlay owns the zzz's.
    frame: 'h-[clamp(230px,33vh,300px)] max-w-[480px]',
    // Head sits top-right of the sprawl, further left than the curled cat's spot.
    zzzPos: 'left-[36%] top-[38px]',
    hello: 'Welcome back. Excuse the pose.',
    helloSignup: 'A new student? I’d wave, but gravity.',
    peek: 'Relax — my eyes are closed.',
    bye: 'Go study. I’ll hold the floor down.',
    quips: [
      'This is advanced resting.',
      'I’m not lazy. I’m buffering.',
      'The floor needed a hug.',
      'Horizontal is a study position.',
      'Belly rubs unlock C1. Probably.',
    ],
  },
]

// Official multi-colour Google "G".
function GoogleIcon() {
  return (
    <svg width={19} height={19} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17Z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7A21.99 21.99 0 0 0 24 46Z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18a13.2 13.2 0 0 1 0-8.36v-5.7H4.34a22.02 22.02 0 0 0 0 19.76l7.35-5.7Z"
      />
      <path
        fill="#EA4335"
        d="M24 9.5c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 2.89 29.93 1 24 1 15.4 1 7.96 5.93 4.34 13.12l7.35 5.7C13.42 13.37 18.27 9.5 24 9.5Z"
      />
    </svg>
  )
}

// Small shield-check for the reassurance card.
function ShieldIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function EyeIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx={12} cy={12} r={3} />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a17.7 17.7 0 0 1-2.16 3.19M6.6 6.6A17.6 17.6 0 0 0 2 11s3.5 7 10 7a9.1 9.1 0 0 0 3.4-.65" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="M2 2l20 20" />
    </svg>
  )
}

// Serves both /login and /signup as a standalone full-screen page (no app
// shell). Session persistence is handled by supabase-js + AuthProvider.
export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [expired, setExpired] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const isLogin = mode === 'login'

  // We were signed out because the server refused the stored token (see
  // SessionExpiredError) — say so, otherwise arriving here looks like a bug.
  // Read in an effect, not a state initializer: consuming the flag is a side
  // effect, and StrictMode double-invokes initializers. Only ever set true, so
  // the re-run that finds the flag already cleared leaves the notice standing.
  useEffect(() => {
    if (consumeSessionExpired()) setExpired(true)
  }, [])

  // Mascot state — mirrors the design's little state machine. Random per load,
  // but ?cat=<key> (or an index) forces a specific alternative for previewing.
  const [catIndex] = useState(() => {
    const forced = new URLSearchParams(window.location.search).get('cat')
    if (forced !== null) {
      const byKey = CATS.findIndex((c) => c.key === forced)
      if (byKey >= 0) return byKey
      const n = Number(forced)
      if (Number.isInteger(n) && n >= 0 && n < CATS.length) return n
    }
    return Math.floor(Math.random() * CATS.length)
  })
  const [awake, setAwake] = useState(false)
  const [peeking, setPeeking] = useState(false)
  const [customText, setCustomText] = useState<string | null>(null)
  const [quipIndex, setQuipIndex] = useState(0)
  const wakeTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (wakeTimer.current) window.clearTimeout(wakeTimer.current)
    }
  }, [])

  const cat = CATS[catIndex]
  const helloText = isLogin ? cat.hello : cat.helloSignup
  const bubbleText = awake
    ? (customText ?? cat.quips[quipIndex % cat.quips.length])
    : peeking
      ? cat.peek
      : helloText
  const showZzz = cat.sleepy && !awake

  // Wake the cat (optionally with a specific line), then doze off again.
  function say(text?: string) {
    if (wakeTimer.current) window.clearTimeout(wakeTimer.current)
    setAwake((wasAwake) => {
      if (!text) setQuipIndex((q) => (wasAwake ? q + 1 : q))
      return true
    })
    setCustomText(text ?? null)
    wakeTimer.current = window.setTimeout(() => {
      setAwake(false)
      setCustomText(null)
      setQuipIndex((q) => q + 1)
    }, 2800)
  }

  if (session) return <Navigate to={from} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    say(cat.bye)
    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        navigate(from, { replace: true })
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data.session) {
          navigate(from, { replace: true })
        } else {
          setInfo(
            'Account created. Check your email for a confirmation link, then come back and sign in.',
          )
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Google OAuth via Supabase. On success the browser redirects to Google (so we
  // don't clear `busy` — the page navigates away); only reset it on error.
  // NOTE: requires the Google provider to be enabled in the Supabase dashboard.
  async function handleGoogle() {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${from}` },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start Google sign-in.')
      setBusy(false)
    }
  }

  const inputClass =
    'w-full box-border rounded-xl border-2 border-line bg-page px-4 py-3.5 text-[15px] font-bold text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-semibold placeholder:text-ink-faint focus:border-accent focus:bg-white focus:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-accent)_13%,transparent)]'

  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] bg-white font-sans text-ink">
      {/* Brand panel with the interactive mascot */}
      <section className="relative flex flex-col overflow-hidden bg-page px-8 pb-10 pt-11 sm:px-14">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/logo-cat.png"
            alt=""
            aria-hidden="true"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <span className="flex flex-col gap-px">
            <span className="text-xl font-black leading-[1.1] text-ink">Cefrly</span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-ink-soft">
              CEFR Exams
            </span>
          </span>
        </Link>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mt-[clamp(36px,11vh,150px)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-ink-soft">
              CEFR · Reading paper
            </p>
            <h1 className="mt-2 text-balance text-[34px] font-black leading-[1.18] text-ink">
              The official reading format,
              <br />
              timed and scored.
            </h1>
          </div>

          <div className="relative mt-auto w-full">
            {/* decorative study-nook vignette filling the space right of the cat */}
            <CozyScene className="pointer-events-none absolute -bottom-1 right-0 z-[1] h-[clamp(235px,36vh,340px)] w-auto" />

            {/* speech bubble */}
            <div className="relative h-[52px]">
              <div
                key={bubbleText}
                className="bubble-pop absolute left-3.5 top-0 z-[3] whitespace-nowrap rounded-[14px] bg-white px-[15px] py-[9px] text-sm font-extrabold text-ink shadow-[0_4px_16px_color-mix(in_srgb,var(--color-brand)_10%,transparent)]"
                aria-live="polite"
              >
                {bubbleText}
                <span
                  className="absolute -bottom-[5px] left-[26px] h-3 w-3 rotate-45 rounded-[2px] bg-white"
                  aria-hidden
                />
              </div>
            </div>

            {/* floating zzz's, only while the sleepy cat dozes (the baked-in
                z's were erased from cat-sleeping.png; this animation is the
                only "zzz" now) */}
            {showZzz && (
              <div
                className={`pointer-events-none absolute z-[2] font-black italic text-ink-faint ${
                  cat.zzzPos ?? 'left-[46%] top-[34px]'
                }`}
                aria-hidden
              >
                <span className="zzz-1 absolute left-0 top-[66px] text-[26px]">z</span>
                <span className="zzz-2 absolute left-[34px] top-[32px] text-[38px]">z</span>
                <span className="zzz-3 absolute left-[80px] top-[-6px] text-[54px]">Z</span>
              </div>
            )}

            {/* the cat — click to poke it awake */}
            <button
              type="button"
              onClick={() => say()}
              aria-label="Poke the cat"
              className={`relative z-[2] block w-full cursor-pointer select-none border-0 bg-transparent p-0 ${cat.frame}`}
            >
              <img
                src={cat.src}
                alt={cat.alt}
                draggable={false}
                className="cat-breathe block h-full w-full object-contain object-[left_bottom]"
              />
            </button>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="grid place-items-center border-l border-line bg-white px-6 py-12 sm:px-[72px]">
        <form onSubmit={handleSubmit} className="flex w-full max-w-[420px] flex-col">
          <h2 className="m-0 text-[32px] font-black text-ink">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="mb-[30px] mt-2 text-[15px] font-semibold text-ink-soft">
            {isLogin
              ? 'Sign in to continue your practice.'
              : 'One free account for all your CEFR practice.'}
          </p>

          <label htmlFor="cef-email" className="mb-2 text-sm font-extrabold text-ink">
            Email
          </label>
          <input
            id="cef-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            autoComplete="email"
            inputMode="email"
            placeholder="name@email.com"
          />

          <div className="h-[18px]" />

          <label htmlFor="cef-pass" className="mb-2 text-sm font-extrabold text-ink">
            Password
          </label>
          <div className="relative w-full">
            <input
              id="cef-pass"
              type={showPw ? 'text' : 'password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPeeking(true)}
              onBlur={() => setPeeking(false)}
              className={`${inputClass} pr-12`}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              placeholder="••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 text-ink-soft transition-colors hover:text-ink"
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {!isLogin && (
            <span className="mt-2 text-xs font-semibold text-ink-soft">At least 6 characters.</span>
          )}

          {expired && !error && (
            <p
              role="status"
              className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800"
            >
              Your session expired, so we signed you out. Please sign in again — your
              progress is saved.
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-xl border-2 border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800"
            >
              {error}
            </p>
          )}
          {info && (
            <p
              role="status"
              className="mt-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800"
            >
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-7 w-full rounded-xl border-0 bg-brand px-4 py-[15px] text-base font-extrabold text-white shadow-[0_8px_20px_color-mix(in_srgb,var(--color-brand)_22%,transparent)] transition-[background,transform] duration-150 hover:bg-brand-deep active:translate-y-px disabled:opacity-60"
          >
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          {/* Google sign-in / registration (needs the Google provider enabled in Supabase) */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-line bg-white px-4 py-[13px] text-[15px] font-bold text-ink transition-colors hover:border-ink-faint hover:bg-page disabled:opacity-60"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* mode toggle, styled as a divider */}
          <div className="mt-6 flex items-center gap-3 text-[15px] font-semibold text-ink-soft">
            <span className="h-px flex-1 bg-line" />
            <span className="whitespace-nowrap">
              {isLogin ? (
                <>
                  No account yet?{' '}
                  <Link
                    to="/signup"
                    state={{ from }}
                    className="font-extrabold text-brand no-underline hover:underline"
                  >
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    state={{ from }}
                    className="font-extrabold text-brand no-underline hover:underline"
                  >
                    Log in
                  </Link>
                </>
              )}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          {/* reassurance card */}
          <div className="mt-6 flex items-center gap-3.5 rounded-2xl bg-page px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
              <ShieldIcon />
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-extrabold text-ink">
                Your progress is safe with us.
              </span>
              <span className="text-[13px] font-semibold text-ink-soft">
                We never share your data.
              </span>
            </span>
          </div>
        </form>
      </section>
    </div>
  )
}
