// ---------------------------------------------------------------------------
// Turn a browser recording into MP3, so every grader in the ladder can read it.
//
// WHY THIS EXISTS. MediaRecorder gives us webm/opus on Chrome and mp4/aac on
// Safari. Gemini reads both; OpenAI reads NEITHER — its audio input takes only
// wav and mp3, which is why `openai/gpt-audio` answered 400 to a real clip
// however the format was labelled (tested 2026-09-02). That left the whole
// fallback ladder inside one vendor: when Google is down everywhere, so is the
// backup. Encoding to MP3 here is what lets a GPT model actually mark a paper.
//
// WAV would have been simpler — a header and raw samples, no dependency — but a
// full paper is ~7 minutes of speech, which is about 14MB uncompressed against
// roughly 1MB as MP3. Students sit these exams on Uzbek mobile data.
//
// THIS PATH IS NEVER ALLOWED TO COST A STUDENT AN ANSWER. Every failure — a
// codec the browser cannot decode, a worker that will not start, an encode that
// takes too long on a cheap phone — returns null, and the caller uploads the
// original recording exactly as it did before. The worst case is that one clip
// can only be graded by Gemini, which is where every clip was yesterday.
// ---------------------------------------------------------------------------

/** 16 kHz mono. Speech models resample to about this anyway, so a higher rate
 *  buys nothing but upload time. Sits inside lamejs's supported MPEG-2 rates. */
const TARGET_RATE = 16_000
/** Mono speech at 32 kbps is clean. Below this, sibilants start to smear, and
 *  pronunciation is one of the five things being marked. */
const TARGET_KBPS = 32
/** A cheap phone encoding a two-minute answer is the slow case. Past this we
 *  stop waiting and send the original — the upload matters more than the
 *  format, because an unsent clip is a lost answer and a webm one is not. */
const ENCODE_TIMEOUT_MS = 25_000

export interface EncodedClip {
  blob: Blob
  mimeType: string
}

/**
 * Decode `blob` and re-encode it as MP3, or return null to mean "use what you
 * already have". Never throws.
 */
export async function toMp3(blob: Blob): Promise<EncodedClip | null> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null
  // Already MP3 (a re-upload, or a browser that records it natively).
  if (/mpeg|mp3/.test(blob.type)) return { blob, mimeType: 'audio/mpeg' }

  let worker: Worker | null = null
  try {
    const pcm = await decodeToMonoPcm(blob)
    if (!pcm || pcm.length === 0) return null

    worker = new Worker(new URL('./mp3Worker.ts', import.meta.url), { type: 'module' })
    const mp3 = await encodeInWorker(worker, pcm)
    if (!mp3 || mp3.length === 0) return null

    // A "smaller" file that is a fraction of the original is usually a truncated
    // encode, not a good one. Trust the original rather than ship a clip that
    // cuts off halfway through the student's answer.
    const expected = (pcm.length / TARGET_RATE) * (TARGET_KBPS * 125)
    if (mp3.length < expected * 0.5) return null

    return { blob: new Blob([mp3 as BlobPart], { type: 'audio/mpeg' }), mimeType: 'audio/mpeg' }
  } catch {
    return null
  } finally {
    worker?.terminate()
  }
}

/**
 * Recording -> mono 16 kHz 16-bit samples.
 *
 * decodeAudioData is the browser's own codec, so it handles whatever this
 * browser chose to record in; OfflineAudioContext then does the downmix and the
 * resample natively. Doing either by hand in JS would be slower and worse.
 */
async function decodeToMonoPcm(blob: Blob): Promise<Int16Array | null> {
  const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx || typeof OfflineAudioContext === 'undefined') return null

  const ctx = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
  } finally {
    // Closing matters: each AudioContext holds a hardware handle, and browsers
    // cap how many a page may open. An exam creates one per answer.
    ctx.close().catch(() => {})
  }
  if (decoded.length === 0) return null

  const frames = Math.max(1, Math.round((decoded.duration * TARGET_RATE)))
  const offline = new OfflineAudioContext(1, frames, TARGET_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const mono = (await offline.startRendering()).getChannelData(0)

  const pcm = new Int16Array(mono.length)
  for (let i = 0; i < mono.length; i++) {
    // Clamp before scaling: resampling can overshoot slightly past ±1, and a
    // wrapped sample is an audible click landing in a pronunciation mark.
    const s = Math.max(-1, Math.min(1, mono[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return pcm
}

function encodeInWorker(worker: Worker, pcm: Int16Array): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const done = (value: Uint8Array | null) => {
      window.clearTimeout(timer)
      resolve(value)
    }
    const timer = window.setTimeout(() => done(null), ENCODE_TIMEOUT_MS)

    worker.onmessage = (e: MessageEvent<{ ok: boolean; mp3?: Uint8Array }>) =>
      done(e.data.ok && e.data.mp3 ? e.data.mp3 : null)
    worker.onerror = () => done(null)
    // The buffer is transferred, so the copy on this side is emptied — nothing
    // reads `pcm` after this point.
    worker.postMessage({ pcm, sampleRate: TARGET_RATE, kbps: TARGET_KBPS }, [pcm.buffer])
  })
}
