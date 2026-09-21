import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudioAsset } from '../../types/test'
import { fetchListeningAudio } from '../../lib/api'
import { useAudioSource } from '../../lib/audioSource'
import { useAudioStore } from '../../store/audio'
import { VolumeControl } from './VolumeControl'

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Resolve once the element knows the file's duration, so a seek lands. */
function whenReady(el: HTMLAudioElement): Promise<void> {
  if (el.readyState >= 1) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const done = () => {
      el.removeEventListener('loadedmetadata', done)
      el.removeEventListener('error', fail)
      resolve()
    }
    const fail = () => {
      el.removeEventListener('loadedmetadata', done)
      el.removeEventListener('error', fail)
      reject(new Error('audio failed to load'))
    }
    el.addEventListener('loadedmetadata', done)
    el.addEventListener('error', fail)
  })
}

// One audio control governing a single recording. Placement decides the mode:
//   per_part  -> one <AudioPlayer> inside each part
//   single    -> one <AudioPlayer> at the top of the whole section
// Exam rules: a previewSec countdown gates the FIRST play (audio locked,
// questions visible); playback is capped at playLimit; there is no seek/pause.
//
// THE PLAY LIMIT IS THE SERVER'S. The audio bucket is private, and every play is
// started by listening-audio, which counts it and refuses the one past the
// limit. A play is a time window on the server's clock: after a refresh, exit
// and resume, or a second tab, the player asks where the running play is and
// RESUMES there — the tape kept rolling. Refreshing can neither buy a replay
// nor burn one.
//
// The FIRST play starts on its own as soon as the recording unlocks, like the
// real hall — but only once the page has had a user gesture (the mode picker
// click), so a play is never spent on an autoplay the browser then blocks.
export function AudioPlayer({ audio, label }: { audio: AudioAsset; label: string }) {
  const source = useAudioSource()
  const previewedGlobal = useAudioStore((s) => s.previewed[audio.assetPath] ?? false)
  const markPreviewed = useAudioStore((s) => s.markPreviewed)
  const markDone = useAudioStore((s) => s.markDone)

  const volume = useAudioStore((s) => s.volume)
  const setVolume = useAudioStore((s) => s.setVolume)

  const audioRef = useRef<HTMLAudioElement>(null)
  const [previewLeft, setPreviewLeft] = useState(previewedGlobal ? 0 : audio.previewSec)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  // From the server. `null` until the first status answer arrives.
  const [playLimit, setPlayLimit] = useState(audio.playLimit)
  const [playsUsed, setPlaysUsed] = useState<number | null>(null)
  const [url, setUrl] = useState('')
  // Client-clock moment the running play began (Date.now() - offset). Null when
  // no play is running. Where we should be = (Date.now() - anchor) / 1000.
  const [anchor, setAnchor] = useState<number | null>(null)

  // Keep the element at the shared volume (store + slider below).
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  /** Seek to where the tape is and play. Returns false if the browser blocked it. */
  const catchUp = useCallback(async () => {
    const el = audioRef.current
    if (!el || anchor === null) return false
    try {
      await whenReady(el)
    } catch {
      return false
    }
    const offset = (Date.now() - anchor) / 1000
    if (Number.isFinite(el.duration) && offset >= el.duration - 0.25) {
      // The play ran out while we were away.
      setAnchor(null)
      markDone(audio.assetPath)
      return true
    }
    el.currentTime = Math.max(0, offset)
    try {
      await el.play()
      return true
    } catch {
      return false
    }
  }, [anchor, audio.assetPath, markDone])

  // Ask the server where this recording stands.
  useEffect(() => {
    if (!source) return
    let cancelled = false
    fetchListeningAudio(source, audio.assetPath, 'status')
      .then((reply) => {
        if (cancelled) return
        if (reply.mode !== 'simulation') {
          // Not a simulation after all — nothing to count.
          setPlaysUsed(0)
          setUrl(reply.url)
          return
        }
        setPlayLimit(reply.playLimit)
        setPlaysUsed(reply.playsUsed)
        if (reply.playsUsed > 0) markPreviewed(audio.assetPath) // the preview window is long over
        if (reply.active) {
          setUrl(reply.active.url)
          setAnchor(Date.now() - reply.active.offsetSec * 1000)
        }
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        markDone(audio.assetPath) // a broken recording must never deadlock submission
      })
    return () => {
      cancelled = true
    }
  }, [source, audio.assetPath, markPreviewed, markDone])

  // A running play found on mount: pick it up where it is.
  const resumeTried = useRef(false)
  useEffect(() => {
    if (resumeTried.current || anchor === null || !url || isPlaying) return
    resumeTried.current = true
    void catchUp()
  }, [anchor, url, isPlaying, catchUp])

  const limit = playLimit
  const used = playsUsed ?? 0
  const playsLeft = Math.max(0, limit - used)
  const running = anchor !== null
  const inPreview = !previewedGlobal && previewLeft > 0
  const loading = playsUsed === null && !failed
  const locked = !inPreview && !loading && playsLeft <= 0 && !running
  const canStart = !inPreview && !loading && playsLeft > 0 && !running && !failed && !busy
  // A play is running on the server but this tab is silent (autoplay blocked
  // after a refresh): one tap catches up, and spends nothing.
  const canResume = running && !isPlaying && !failed

  // Preview countdown — runs once, on first mount for this recording.
  useEffect(() => {
    if (previewedGlobal) return
    if (audio.previewSec <= 0) {
      markPreviewed(audio.assetPath)
      return
    }
    const id = setInterval(() => {
      setPreviewLeft((s) => {
        if (s <= 1) {
          clearInterval(id)
          markPreviewed(audio.assetPath)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // Intentionally mount-only: the preview is a one-time reading window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startPlay() {
    if (!source || !canStart) return
    setBusy(true)
    try {
      const reply = await fetchListeningAudio(source, audio.assetPath, 'start')
      if (reply.mode !== 'simulation' || !reply.active) return
      setPlaysUsed(reply.playsUsed)
      setUrl(reply.active.url)
      setAnchor(Date.now())
      resumeTried.current = true // started here, so there is nothing to resume
      await playFromZero(reply.active.url)
    } catch {
      // Refused (every play used, or taken by another tab): re-read the truth.
      try {
        const reply = await fetchListeningAudio(source, audio.assetPath, 'status')
        if (reply.mode === 'simulation') {
          setPlaysUsed(reply.playsUsed)
          if (reply.active) {
            setUrl(reply.active.url)
            setAnchor(Date.now() - reply.active.offsetSec * 1000)
          }
        }
      } catch {
        setFailed(true)
        markDone(audio.assetPath)
      }
    } finally {
      setBusy(false)
    }
  }

  async function playFromZero(src: string) {
    const el = audioRef.current
    if (!el) return
    try {
      // Set directly: React would only apply the new src on its next render.
      if (el.src !== src) el.src = src
      await whenReady(el)
      el.currentTime = 0
      await el.play()
    } catch {
      /* blocked — the Resume button takes over, at the right offset */
    }
  }

  // Auto-start the first play once unlocked, for a never-played recording, and
  // only after a user gesture on this page (see the note above).
  const autoplayTried = useRef(false)
  useEffect(() => {
    if (autoplayTried.current || !canStart || used > 0) return
    const activated = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation?.hasBeenActive
    if (activated === false) return
    autoplayTried.current = true
    void startPlay()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStart, used])

  function handleButton() {
    if (canResume) void catchUp()
    else void startPlay()
  }

  const status = failed
    ? 'This recording could not be loaded.'
    : loading
      ? 'Loading the recording…'
      : inPreview
        ? `Recording unlocks in ${previewLeft}s — read the questions first.`
        : isPlaying
          ? 'Playing…'
          : canResume
            ? 'The recording is running — press play to catch up.'
            : locked
              ? `You have used all ${limit} plays of this recording.`
              : `Ready — ${playsLeft} of ${limit} play${limit === 1 ? '' : 's'} left.`

  return (
    <div className="rounded-2xl border border-line bg-brand-soft/40 p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleButton}
          disabled={!(canStart || canResume)}
          aria-label={isPlaying ? 'Recording playing' : canResume ? `Resume ${label}` : `Play ${label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {locked ? <LockIcon /> : isPlaying ? <SoundIcon /> : <PlayIcon />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-heading">{label}</span>
            <PlayDots used={used} total={limit} />
          </div>
          <p className="tnum mt-0.5 text-xs text-ink-soft" aria-live="polite">
            {status}
          </p>
        </div>

        {duration > 0 && (
          <span className="tnum text-xs text-ink-soft">
            {fmt(current)} / {fmt(duration)}
          </span>
        )}
        <VolumeControl value={volume} onChange={setVolume} />
      </div>

      {/* Read-only progress (no seeking). */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200"
          style={{ width: `${Math.round((isPlaying ? progress : locked ? 1 : 0) * 100)}%` }}
        />
      </div>

      {inPreview && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white" aria-hidden>
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round((1 - previewLeft / Math.max(1, audio.previewSec)) * 100)}%` }}
          />
        </div>
      )}

      <audio
        ref={audioRef}
        src={url || undefined}
        preload="auto"
        onPlay={() => setIsPlaying(true)}
        // No pause control exists; a pause is the browser's (an interruption).
        // The server's tape keeps going, so the button offers a catch-up.
        onPause={(e) => {
          if (!e.currentTarget.ended) setIsPlaying(false)
        }}
        onEnded={() => {
          setAnchor(null)
          setIsPlaying(false)
          setProgress(0)
          setCurrent(0)
          markDone(audio.assetPath) // the recording has run its course — listening's "time is up"
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0)
          e.currentTarget.volume = volume
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget
          if (el.duration > 0) setProgress(el.currentTime / el.duration)
          setCurrent(el.currentTime)
        }}
        onError={() => {
          setFailed(true)
          markDone(audio.assetPath) // a broken recording must never deadlock submission
        }}
      />
    </div>
  )
}

function PlayDots({ used, total }: { used: number; total: number }) {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${i < used ? 'bg-brand/40' : 'bg-brand'}`}
        />
      ))}
    </span>
  )
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}
function SoundIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="M16 9a4 4 0 0 1 0 6" />
      <path d="M19 6a8 8 0 0 1 0 12" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
