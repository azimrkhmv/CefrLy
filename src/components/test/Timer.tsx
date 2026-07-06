import { useEffect, useMemo, useRef, useState } from 'react'

// Counts down to a server-issued deadline. Refreshing the page does not reset
// the clock — the deadline comes from the test session, not from mount time.
//
// `serverNow` (the server's clock when the session was issued) lets us correct
// for a wrong device clock: we count against `Date.now() + offset`, not the
// bare local time. `pausedAt` freezes the display (practice mode) — while set,
// the clock neither ticks nor auto-submits.
export function Timer({
  expiresAt,
  onExpire,
  serverNow,
  pausedAt,
}: {
  expiresAt: string
  onExpire: () => void
  serverNow?: string
  pausedAt?: string | null
}) {
  const deadline = useMemo(() => new Date(expiresAt).getTime(), [expiresAt])
  const offset = useMemo(
    () => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0),
    [serverNow],
  )
  const pausedMs = pausedAt ? new Date(pausedAt).getTime() : null

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.round((deadline - (pausedMs ?? Date.now() + offset)) / 1000)),
  )
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    // Frozen while paused — show the remaining time, but never tick or expire.
    if (pausedMs !== null) {
      setRemaining(Math.max(0, Math.round((deadline - pausedMs) / 1000)))
      return
    }
    let fired = false
    const tick = () => {
      const left = Math.max(0, Math.round((deadline - (Date.now() + offset)) / 1000))
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
  }, [deadline, offset, pausedMs])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const isPaused = pausedMs !== null
  const runningLow = !isPaused && remaining <= 300

  return (
    <span
      className={`tnum text-lg font-extrabold ${
        isPaused ? 'text-ink-faint' : runningLow ? 'text-rose-600' : 'text-heading'
      }`}
      aria-label={`Time remaining: ${minutes} minutes ${seconds} seconds${
        isPaused ? ' (paused)' : ''
      }`}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </span>
  )
}
