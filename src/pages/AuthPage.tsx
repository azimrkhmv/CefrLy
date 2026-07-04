import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

// Two mascots, one picked at random on load. Personality lives in the copy.
type CatDef = {
  src: string
  alt: string
  sleepy: boolean
  hello: string
  helloSignup: string
  peek: string
  bye: string
  quips: string[]
}

const CATS: CatDef[] = [
  {
    src: '/cat-sleeping.png',
    alt: 'A sleepy purple cat curled up on a lavender cushion',
    sleepy: true,
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
]

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
  const navigate = useNavigate()
  const location = useLocation()
  const { session } = useAuth()

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const isLogin = mode === 'login'

  // Mascot state — mirrors the design's little state machine.
  const [catIndex] = useState(() => Math.floor(Math.random() * CATS.length))
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

  const inputClass =
    'w-full box-border rounded-xl border-2 border-[#ECE7F8] bg-[#FAF8FE] px-4 py-3.5 text-[15px] font-bold text-[#2E2A47] outline-none transition-[border-color,box-shadow] duration-150 placeholder:font-semibold placeholder:text-[#B0A9CE] focus:border-[#8A63E8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(138,99,232,0.13)]'

  return (
    <div className="grid min-h-screen grid-cols-[repeat(auto-fit,minmax(min(480px,100%),1fr))] bg-white font-sans text-[#2E2A47]">
      {/* Brand panel with the interactive mascot */}
      <section className="relative flex flex-col overflow-hidden bg-[#F6F4FB] px-8 pb-10 pt-11 sm:px-14">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[13px] bg-[#3B2C86] text-xl font-black text-white shadow-[0_6px_14px_rgba(59,44,134,0.22)]">
            C
          </span>
          <span className="flex flex-col gap-px">
            <span className="text-xl font-black leading-[1.1] text-[#2E2A47]">Cefrly</span>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#918BAD]">
              CEFR Exams
            </span>
          </span>
        </Link>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mt-[clamp(36px,11vh,150px)]">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#6F6890]">
              CEFR · Reading paper
            </p>
            <h1 className="mt-2 text-balance text-[34px] font-black leading-[1.18] text-[#2E2A47]">
              The official reading format,
              <br />
              timed and scored.
            </h1>
          </div>

          <div className="relative mt-auto w-full">
            {/* speech bubble */}
            <div className="relative h-[52px]">
              <div
                key={bubbleText}
                className="bubble-pop absolute left-3.5 top-0 z-[3] whitespace-nowrap rounded-[14px] bg-white px-[15px] py-[9px] text-sm font-extrabold text-[#453A72] shadow-[0_4px_16px_rgba(59,44,134,0.10)]"
                aria-live="polite"
              >
                {bubbleText}
                <span
                  className="absolute -bottom-[5px] left-[26px] h-3 w-3 rotate-45 rounded-[2px] bg-white"
                  aria-hidden
                />
              </div>
            </div>

            {/* floating zzz's, only while the sleepy cat dozes */}
            {showZzz && (
              <div
                className="pointer-events-none absolute left-[46%] top-[34px] z-[2] font-black italic text-[#C1AEF0]"
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
              className="block h-[clamp(230px,33vh,300px)] w-full max-w-[480px] cursor-pointer select-none border-0 bg-transparent p-0"
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
      <section className="grid place-items-center border-l border-[#EFEBF8] bg-white px-6 py-12 sm:px-[72px]">
        <form onSubmit={handleSubmit} className="flex w-full max-w-[420px] flex-col">
          <h2 className="m-0 text-[32px] font-black text-[#2E2A47]">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="mb-[30px] mt-2 text-[15px] font-semibold text-[#8D87A8]">
            {isLogin
              ? 'Sign in to continue your practice.'
              : 'One free account for all your CEFR practice.'}
          </p>

          <label htmlFor="cef-email" className="mb-2 text-sm font-extrabold text-[#4A4468]">
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

          <label htmlFor="cef-pass" className="mb-2 text-sm font-extrabold text-[#4A4468]">
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
              className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center border-0 bg-transparent p-0 text-[#8D87A8] transition-colors hover:text-[#5A5280]"
            >
              {showPw ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          {!isLogin && (
            <span className="mt-2 text-xs font-semibold text-[#8D87A8]">At least 6 characters.</span>
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
            className="mt-7 w-full rounded-xl border-0 bg-[#3B2C86] px-4 py-[15px] text-base font-extrabold text-white shadow-[0_8px_20px_rgba(59,44,134,0.22)] transition-[background,transform] duration-150 hover:bg-[#4A39A3] active:translate-y-px disabled:opacity-60"
          >
            {busy ? 'Please wait…' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          <p className="mt-5 text-center text-[15px] font-semibold text-[#8D87A8]">
            {isLogin ? (
              <>
                Don&apos;t have an account?{' '}
                <Link
                  to="/signup"
                  state={{ from }}
                  className="font-extrabold text-[#6D4FE0] no-underline hover:underline"
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
                  className="font-extrabold text-[#6D4FE0] no-underline hover:underline"
                >
                  Log in
                </Link>
              </>
            )}
          </p>
        </form>
      </section>
    </div>
  )
}
