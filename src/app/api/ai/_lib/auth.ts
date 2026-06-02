import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export interface AiContext {
  openaiKey: string | null;
  isAdmin: boolean;
  isPro: boolean;
  userId: string | null;
  error?: string;
}

/**
 * Resolves which OpenAI key to use for the calling user.
 *
 * Priority:
 *   1. Admin   → system OPENAI_API_KEY (free for the platform owner)
 *   2. Regular → their own key from user_ai_keys (RLS-protected)
 *   3. No key  → returns null; caller should return 402 with instructions
 *
 * isPro indicates access to the MixHive-hosted SD/HF art endpoint.
 */
export async function resolveAiContext(req: NextRequest): Promise<AiContext> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      openaiKey: null,
      isAdmin: false,
      isPro: false,
      userId: null,
      error: 'Not authenticated',
    };
  }

  const jwt = authHeader.slice(7);
  const hasNextPublicSupabasePair = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const supabaseUrl = hasNextPublicSupabasePair
    ? process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = hasNextPublicSupabasePair
    ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      openaiKey: null,
      isAdmin: false,
      isPro: false,
      userId: null,
      error: 'Supabase not configured',
    };
  }

  // User-scoped client — RLS enforced by the caller's JWT
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authErr,
  } = await sb.auth.getUser();
  if (authErr || !user) {
    return {
      openaiKey: null,
      isAdmin: false,
      isPro: false,
      userId: null,
      error: 'Invalid session',
    };
  }

  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin, is_pro')
    .eq('id', user.id)
    .single();

  const isAdmin = Boolean(profile?.is_admin);
  const isPro = isAdmin || Boolean(profile?.is_pro);

  // Admins get the platform key
  if (isAdmin) {
    const systemKey = process.env.OPENAI_API_KEY ?? null;
    return { openaiKey: systemKey, isAdmin: true, isPro: true, userId: user.id };
  }

  // Regular users get their own stored key
  const { data: aiKeyRow } = await sb
    .from('user_ai_keys')
    .select('openai_api_key')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    openaiKey: aiKeyRow?.openai_api_key ?? null,
    isAdmin: false,
    isPro,
    userId: user.id,
  };
}

/** Standard 402 response with setup instructions. */
export function noKeyResponse() {
  return Response.json(
    {
      error: 'no_ai_key',
      message: 'No OpenAI API key configured.',
      instructions:
        'Add your key in Settings → AI & Creativity, or upgrade to MixHive Pro for built-in AI art generation.',
      setup_url: '/settings#ai',
      get_key_url: 'https://platform.openai.com/api-keys',
    },
    { status: 402 }
  );
}
