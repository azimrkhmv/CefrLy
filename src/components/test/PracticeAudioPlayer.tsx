import { useEffect, useRef, useState } from 'react'
import type { AudioAsset } from '../../types/test'
import { audioUrl } from '../../lib/storage'
import { useAudioStore } from '../../store/audio'

// The PRACTICE-mode listening player: a normal media control. Unlike the
// simulation player (AudioPlayer.tsx) there is NO preview gate and NO play cap —
// the student is learning, so they can play/pause, scrub, and jump ±10s freely.
// The recording still auto-starts the FIRST time its part is opened (tests flow
// like an exam); the shared audio store remembers that, so navigating back to a
// part never restarts it. Simulation keeps the strict exam rules.
const SKIP = 10

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PracticeAudioPlayer({ audio, label }: { audio: AudioAsset; label: string }) {
  const url = audioUrl(audio.assetPath)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)

  // Pause playback if this player unmounts (e.g. navigating to another part).
  useEffect(() => {
    const el = audioRef.current
    return () => {
      el?.pause()
    }
  }, [])

  // Auto-start on the FIRST open of this part only; afterwards the student
  // drives. Marked up-front so a blocked autoplay (no user gesture yet, e.g.
  // after a refresh) degrades to the ordinary play button, not a retry loop.
  const started = useAudioStore((s) => (s.plays[audio.assetPath] ?? 0) > 0)
  const usePlay = useAudioStore((s) => s.usePlay)
  useEffect(() => {
    if (started || failed) return
    usePlay(audio.assetPath)
    void audioRef.current?.play().catch(() => {
      /* autoplay blocked — the student presses play instead */
    })
    // Intentionally mount-only: one attempt per first visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    const el = audioRef.current
    if (!el || failed) return
    if (el.paused) void el.play().catch(() => setFailed(true))
    else el.pause()
  }

  function skip(delta: number) {
    const el = audioRef.current
    if (!el) return
    const max = Number.isFinite(el.duration) ? el.duration : current + Math.abs(delta)
    el.currentTime = Math.min(max, Math.max(0, el.currentTime + delta))
  }

  function seek(value: number) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = value
    setCurrent(value)
  }

  return (
    <div className="rounded-2xl border border-line bg-brand-soft/40 p-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-heading">{label}</span>
        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-brand">
          Practice
        </span>
        <span className="tnum ml-auto text-xs text-ink-soft">
          {fmt(current)} / {fmt(duration)}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => skip(-SKIP)}
          disabled={failed}
          aria-label="Rewind 10 seconds"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-ink-faint disabled:opacity-40"
        >
          <BackTenIcon />
        </button>

        <button
          type="button"
          onClick={toggle}
          disabled={failed}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep disabled:opacity-40"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          onClick={() => skip(SKIP)}
          disabled={failed}
          aria-label="Forward 10 seconds"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:border-ink-faint disabled:opacity-40"
        >
          <FwdTenIcon />
        </button>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="accent-brand h-1.5 flex-1 cursor-pointer"
          disabled={failed || duration === 0}
        />
      </div>

      {failed && (
        <p className="mt-2 text-xs text-rose-700">This recording could not be loaded.</p>
      )}

      <audio
        ref={audioRef}
        src={url || undefined}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  )
}
function BackTenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 8 6 12l5 4" />
      <path d="M6 12h9a4 4 0 0 1 0 8h-1" />
    </svg>
  )
}
function FwdTenIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 8l5 4-5 4" />
      <path d="M18 12H9a4 4 0 0 0 0 8h1" />
    </svg>
  )
}
