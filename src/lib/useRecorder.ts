import { useCallback, useEffect, useRef, useState } from 'react'

// ---------------------------------------------------------------------------
// Microphone recording, extracted so the mic check and the exam recorder share
// one implementation. Owns the device, the MediaRecorder, the live level meter
// and the resulting clip; the UI on top owns how it looks.
//
// Nothing is uploaded — the clip lives in an object URL, revoked when replaced
// or when the component unmounts. Leaving a stream open keeps the browser's
// "recording" indicator lit, so every path tears the device down.
// ---------------------------------------------------------------------------

export type RecorderStatus =
  | 'unsupported' // no MediaRecorder / not a secure context
  | 'idle'
  | 'requesting' // waiting on the permission prompt
  | 'recording'
  | 'recorded'
  | 'denied'

export interface Recording {
  url: string
  blob: Blob
  durationSec: number
}

function supported() {
  return (
    typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  )
}

/** Backstop for callers that pass no limit (the mic check). The exam always
 *  passes the question's own speaking window to `start()`. */
const SAFETY_CAP_SEC = 10 * 60

export function useRecorder() {
  const [status, setStatus] = useState<RecorderStatus>(() => (supported() ? 'idle' : 'unsupported'))
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState(0) // 0..1, for the live meter
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState<Recording | null>(null)

  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const urlRef = useRef<string | null>(null)
  const limitRef = useRef(SAFETY_CAP_SEC)
  const cutoffRef = useRef<number | null>(null)

  const teardown = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (cutoffRef.current !== null) window.clearTimeout(cutoffRef.current)
    cutoffRef.current = null
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setLevel(0)
  }, [])

  useEffect(() => {
    return () => {
      teardown()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [teardown])

  const stop = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  /**
   * Open the microphone and record for at most `limitSec` seconds. The exam
   * clock is rigid, so the cutoff is enforced here rather than by the UI. It is
   * armed twice on purpose: the rAF meter checks it every frame, and a timeout
   * backs that up because rAF is paused in a hidden tab — switching away must
   * not buy the student extra speaking time.
   */
  const start = useCallback(async (limitSec: number = SAFETY_CAP_SEC) => {
    if (!supported()) {
      setStatus('unsupported')
      return
    }
    limitRef.current = limitSec
    setError(null)
    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Live level meter: the fastest way to see the mic is actually picking up.
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128
          if (v > peak) peak = v
        }
        setLevel((prev) => Math.max(peak, prev * 0.86)) // decay, so it falls smoothly
        const secs = (Date.now() - startedAtRef.current) / 1000
        setElapsed(secs)
        if (secs >= limitRef.current) {
          stop()
          return // no next frame — onstop tears the meter down
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      const chunks: BlobPart[] = []
      // 24 kbps mono. Speech stays perfectly clear at this rate and the grader
      // charges by the SECOND of audio, not the kilobyte — so the only thing a
      // lower bitrate changes is how long the upload takes on a phone, which is
      // the part the student actually waits for.
      const recorder = new MediaRecorder(stream, { audioBitsPerSecond: 24000 })
      recorderRef.current = recorder
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      recorder.onstop = () => {
        // Clamped: a stop fired a few ms late must not report 30.4s of a 30s turn.
        const durationSec = Math.min(
          (Date.now() - startedAtRef.current) / 1000,
          limitRef.current,
        )
        teardown()
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = URL.createObjectURL(blob)
        setRecording({ url: urlRef.current, blob, durationSec })
        setElapsed(durationSec)
        setStatus('recorded')
      }

      startedAtRef.current = Date.now()
      recorder.start()
      setElapsed(0)
      setStatus('recording')
      cutoffRef.current = window.setTimeout(stop, limitSec * 1000)
      tick()
    } catch (e) {
      teardown()
      setStatus('denied')
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Microphone permission was blocked. Allow it in your browser settings and try again.'
          : 'No microphone was found. Plug one in or check your system settings.',
      )
    }
  }, [teardown, stop])

  /** Throw the clip away and go back to idle — used by "Record again". */
  const reset = useCallback(() => {
    teardown()
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = null
    setRecording(null)
    setElapsed(0)
    setError(null)
    setStatus(supported() ? 'idle' : 'unsupported')
  }, [teardown])

  return { status, error, level, elapsed, recording, start, stop, reset }
}
