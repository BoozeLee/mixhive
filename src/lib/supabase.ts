import { createClient } from '@supabase/supabase-js'

declare global {
  interface Window {
    __MIXHIVE_DISABLE_SUPABASE__?: boolean
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const isSupabaseRuntimeDisabled = typeof window !== 'undefined' && window.__MIXHIVE_DISABLE_SUPABASE__ === true
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !isSupabaseRuntimeDisabled)

if (!isSupabaseConfigured) {
  console.warn('Missing Supabase env vars. Copy .env.example to .env and fill in values.')
}

export const supabase = createClient(
  supabaseUrl || 'http://127.0.0.1:54321',
  supabaseAnonKey || 'missing-anon-key',
  {
    auth: {
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
      persistSession: isSupabaseConfigured,
    },
  },
)
