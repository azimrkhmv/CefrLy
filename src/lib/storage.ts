import { supabase } from './supabase'

// Listening media lives in two Storage buckets, both admin-only write (RLS:
// is_admin()); uploads only ever happen from the admin console.
//   images -> Part 4 maps and sample photos. PUBLIC read.
//   audio  -> recordings. PRIVATE since migration 0035: a public URL would let a
//             student replay a simulation recording as often as they like.
//             Students get signed URLs from the listening-audio edge function
//             (which counts plays); admins sign their own with signedAudioUrl.
export type MediaBucket = 'audio' | 'images'

/** Public URL of an image. Empty path -> ''. */
export function imageUrl(assetPath: string | undefined): string {
  if (!assetPath) return ''
  return supabase.storage.from('images').getPublicUrl(assetPath).data.publicUrl
}

/**
 * ADMIN ONLY: a short-lived URL for previewing a recording. Storage RLS lets
 * only admins read the audio bucket, so this rejects for anyone else. Students
 * go through fetchListeningAudio (src/lib/api.ts) instead.
 */
export async function signedAudioUrl(assetPath: string | undefined): Promise<string> {
  if (!assetPath) return ''
  const { data, error } = await supabase.storage.from('audio').createSignedUrl(assetPath, 60 * 60)
  if (error || !data) throw new Error(error?.message ?? 'Could not load the recording')
  return data.signedUrl
}

/**
 * Admin-only upload. Returns the stored object path (what goes in `assetPath`).
 * RLS rejects non-admins server-side, so this throws for them.
 */
export async function uploadMedia(bucket: MediaBucket, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
    cacheControl: '3600',
  })
  if (error) throw new Error(error.message)
  return path
}
