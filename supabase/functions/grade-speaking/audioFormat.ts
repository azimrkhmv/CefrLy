/**
 * WHAT EACH PROVIDER WILL ACCEPT AS AUDIO.
 *
 * Kept in its own module, with no imports, so it can be tested without Deno, a
 * network or a model — see scoring.test.ts. The rules here decided, once, that
 * a whole outage lost every paper: OpenAI could not read the clips, so the
 * "fallback" was Gemini behind Gemini.
 *
 * The browser now uploads MP3 (src/lib/mp3Encoder.ts) precisely so that stops
 * being true — but that encoding is allowed to fail back to the raw recording,
 * so nothing downstream may ASSUME mp3. Every function here is asked, never
 * told, what format a clip is in.
 */

/** The only formats OpenAI's audio input accepts. Anything else is a 400,
 *  whatever the mime type claims — tested against a real clip, 2026-09-02. */
export const GPT_AUDIO_FORMATS = new Set(['mp3', 'wav'])

/**
 * Mime type -> the short format name OpenRouter's `input_audio` expects.
 *
 * MediaRecorder labels the same codec several ways ("audio/webm;codecs=opus"),
 * and MP3 arrives as audio/mpeg far more often than audio/mp3, so this matches
 * on substrings rather than equality.
 */
export function orAudioFormat(mime: string | undefined | null): string {
  const m = (mime ?? '').toLowerCase()
  if (m.includes('mpeg') || m.includes('mp3')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  if (m.includes('mp4') || m.includes('m4a') || m.includes('aac')) return 'mp4'
  if (m.includes('ogg')) return 'ogg'
  return 'webm'
}

/** True only when EVERY clip is one ChatGPT can read. One legacy webm in the
 *  batch fails the whole call, so a mixed attempt must not spend a try on it. */
export function gptCanRead(clips: { format: string }[]): boolean {
  return clips.length > 0 && clips.every((c) => GPT_AUDIO_FORMATS.has(c.format))
}

/**
 * Mime type -> what Gemini's inline_data wants.
 *
 * Gemini documents `audio/mp3`; browsers and our own encoder say `audio/mpeg`.
 * It has accepted both, but the primary lane is not the place to find out, so
 * the name is normalised on the way in. Codec parameters are dropped for the
 * same reason ("audio/webm;codecs=opus" is a valid label that need not be a
 * valid key).
 */
export function geminiMime(mime: string | undefined | null): string {
  const m = (mime ?? '').toLowerCase().split(';')[0].trim()
  if (m === 'audio/mpeg' || m === 'audio/mp3') return 'audio/mp3'
  return m || 'audio/webm'
}
