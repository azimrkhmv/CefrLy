import { useEffect, useMemo, useRef, useState } from 'react'

// Counts down to a server-issued deadline. Refreshing the page does not reset
// the clock — the deadline comes from the test session, not from mount time.
export function Timer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const deadline = useMemo(() => new Date(expiresAt).getTime(), [expiresAt])
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadline - Date.now()) / 1000)),
  )
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    let fired = false
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !fired) {
        fired = true
        clearInterval(interval)
        onExpireRef.current()
      }
    }
    const interval = setInterval(tick, 500)
    tick()
    return () => clearInterval(interval)
  }, [deadline])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const runningLow = remaining <= 300

  return (
    <span
      className={`rounded-md px-3 py-1.5 font-mono text-sm font-semibold tabular-nums ${
        runningLow ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
      }`}
      aria-label={`Time remaining: ${minutes} minutes ${seconds} seconds`}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}
