import { useEffect, useRef, useState } from 'react'
import type { AudioAsset } from '../../types/test'
import { audioUrl } from '../../lib/storage'
import { useAudioStore } from '../../store/audio'
import { VolumeControl } from './VolumeControl'

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// One audio control governing a single recording. Placement decides the mode:
//   per_part  -> one <AudioPlayer> inside each part
//   single    -> one <AudioPlayer> at the top of the whole section
// Exam rules enforced here: a previewSec countdown gates the FIRST play (audio
// locked, questions visible); playback is capped at playLimit; there is no
// seek/pause (a recording plays right through, exactly like a real exam). The
// FIRST play starts automatically as soon as the recording unlocks — in the
// real hall the tape rolls on its own. If the browser blocks the autoplay (no
// user gesture yet, e.g. straight after a refresh) the player stays manual.
// Play/preview state lives in useAudioStore so it survives part navigation.
export function AudioPlayer({ audio, label }: { audio: AudioAsset; label: string }) {
  const url = audioUrl(audio.assetPath)
  const playsUsed = useAudioStore((s) => s.plays[audio.assetPath] ?? 0)
  const previewedGlobal = useAudioStore((s) => s.previewed[audio.assetPath] ?? false)
  const usePlay = useAudioStore((s) => s.usePlay)
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

  // Keep the element at the shared volume (store + slider below).
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume
  }, [volume])

  const playsLeft = Math.max(0, audio.playLimit - playsUsed)
  const inPreview = !previewedGlobal && previewLeft > 0
  const locked = !inPreview && playsLeft <= 0 && !isPlaying
  const canPlay = !inPreview && playsLeft > 0 && !isPlaying && !failed

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

  // Auto-start the first play once the recording is unlocked (immediately when
  // previewSec is 0, else when the countdown ends). Only ever attempted for a
  // never-played recording, and only once per mount — returning to a part or a
  // blocked autoplay falls back to the manual play button.
  const autoplayTried = useRef(false)
  useEffect(() => {
    if (autoplayTried.current || inPreview || failed || isPlaying) return
    if (playsUsed > 0 || playsLeft <= 0) return
    const el = audioRef.current
    if (!el) return
    autoplayTried.current = true
    el.currentTime = 0
    void el.play().catch(() => {
      /* autoplay blocked — the student presses play instead */
    })
  }, [inPreview, failed, isPlaying, playsUsed, playsLeft])

  function handlePlay() {
    const el = audioRef.current
    if (!el || !canPlay) return
    el.currentTime = 0
    void el.play().catch(() => setFailed(true))
  }

  const status = failed
    ? 'This recording could not be loaded.'
    : inPreview
      ? `Recording unlocks in ${previewLeft}s — read the questions first.`
      : isPlaying
        ? 'Playing…'
        : locked
          ? `You have used all ${audio.playLimit} plays of this recording.`
          : `Ready — ${playsLeft} of ${audio.playLimit} play${audio.playLimit === 1 ? '' : 's'} left.`

  return (
    <div className="rounded-2xl border border-line bg-brand-soft/40 p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePlay}
          disabled={!canPlay}
          aria-label={isPlaying ? 'Recording playing' : `Play ${label}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          {locked ? <LockIcon /> : isPlaying ? <SoundIcon /> : <PlayIcon />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-heading">{label}</span>
            <PlayDots used={playsUsed} total={audio.playLimit} />
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
        onPlay={() => {
          setIsPlaying(true)
          usePlay(audio.assetPath)
        }}
        onEnded={() => {
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
