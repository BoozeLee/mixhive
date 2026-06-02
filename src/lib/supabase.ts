import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    __MIXHIVE_DISABLE_SUPABASE__?: boolean;
  }
}

const hasNextPublicSupabasePair = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const supabaseUrl = hasNextPublicSupabasePair
  ? process.env.NEXT_PUBLIC_SUPABASE_URL
  : process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = hasNextPublicSupabasePair
  ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  : process.env.VITE_SUPABASE_ANON_KEY;
const isSupabaseRuntimeDisabled =
  typeof window !== 'undefined' && window.__MIXHIVE_DISABLE_SUPABASE__ === true;
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !isSupabaseRuntimeDisabled
);

if (!isSupabaseConfigured) {
  console.warn(
    'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY.'
  );
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
  }
);

// Service-role client for server-side operations (background workers, admin tasks)
// Uses SUPABASE_SERVICE_ROLE_KEY env var set in Vercel dashboard
// Never expose this to the browser — server-side import only
export function createServerClient() {
  const url = supabaseUrl || process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
