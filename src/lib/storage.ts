import { supabase } from './supabase'

// Listening media lives in two public Storage buckets:
//   audio  -> recordings   images -> Part 4 map/plan images
// Both are public-read (students stream/display via the public URL) but
// admin-only write (RLS: is_admin()). Uploads only ever happen from /admin.
export type MediaBucket = 'audio' | 'images'

/** Resolve a stored object path to its public URL. Empty path -> ''. */
export function publicAssetUrl(bucket: MediaBucket, assetPath: string | undefined): string {
  if (!assetPath) return ''
  return supabase.storage.from(bucket).getPublicUrl(assetPath).data.publicUrl
}

export const audioUrl = (assetPath: string | undefined) => publicAssetUrl('audio', assetPath)
export const imageUrl = (assetPath: string | undefined) => publicAssetUrl('images', assetPath)

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
