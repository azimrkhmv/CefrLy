import { useEffect, useRef, useState } from 'react'

export function Timer({ durationSec, onExpire }: { durationSec: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(durationSec)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    const deadline = Date.now() + durationSec * 1000
    let fired = false
    setRemaining(durationSec)
    const interval = setInterval(() => {
      const left = Math.max(0, Math.round((deadline - Date.now()) / 1000))
      setRemaining(left)
      if (left <= 0 && !fired) {
        fired = true
        clearInterval(interval)
        onExpireRef.current()
      }
    }, 500)
    return () => clearInterval(interval)
  }, [durationSec])

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
