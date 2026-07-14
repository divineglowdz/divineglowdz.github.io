import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
const supabaseEnabled = import.meta.env.VITE_SUPABASE_ENABLED?.trim().toLowerCase()

export const isSupabasePaused = supabaseEnabled === 'false'
export const isSupabaseConfigured = !isSupabasePaused && Boolean(url && anonKey && !url?.includes('your-project'))
export const supabase = createClient(
  isSupabaseConfigured ? url! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey! : 'placeholder-anon-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  },
)
