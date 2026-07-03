import { createClient } from '@supabase/supabase-js'

// The frontend uses ONLY the public URL + anon key. The service_role key lives
// exclusively in Edge Function secrets — never here.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** False until .env is filled in (see .env.example). The app still boots so the
 *  UI can be previewed; auth and data calls will fail until configured. */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
