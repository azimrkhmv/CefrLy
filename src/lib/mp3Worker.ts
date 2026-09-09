/// <reference lib="webworker" />
import { Mp3Encoder } from '@breezystack/lamejs'

// ---------------------------------------------------------------------------
// MP3 encoding, off the main thread.
//
// This runs while a student is reading the next question, so it must never
// touch the UI thread: lamejs is a pure-JS encoder and its inner loop will
// happily freeze a cheap phone for several seconds. The main thread does the
// decoding (native, fast) and sends raw PCM here; this file only encodes.
//
// Vite bundles this as its own chunk, so lamejs is downloaded ONLY by students
// who actually record something — never by anyone opening the home page.
// ---------------------------------------------------------------------------

interface EncodeRequest {
  pcm: Int16Array
  sampleRate: number
  kbps: number
}

/** Samples per encodeBuffer call. lamejs allocates per call, so very small
 *  blocks are wasteful and very large ones spike memory on a low-end phone. */
const BLOCK = 4096

self.onmessage = (e: MessageEvent<EncodeRequest>) => {
  const { pcm, sampleRate, kbps } = e.data
  try {
    const encoder = new Mp3Encoder(1, sampleRate, kbps)
    const chunks: Uint8Array[] = []
    for (let i = 0; i < pcm.length; i += BLOCK) {
      const block = pcm.subarray(i, Math.min(i + BLOCK, pcm.length))
      const out = encoder.encodeBuffer(block)
      if (out.length > 0) chunks.push(out)
    }
    const tail = encoder.flush()
    if (tail.length > 0) chunks.push(tail)

    // One buffer, transferred rather than copied.
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const mp3 = new Uint8Array(total)
    let at = 0
    for (const c of chunks) {
      mp3.set(c, at)
      at += c.length
    }
    self.postMessage({ ok: true, mp3 }, { transfer: [mp3.buffer] })
  } catch (err) {
    // The caller keeps the original recording, so a failure here costs the
    // student nothing — it only means this clip stays in its native format.
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
