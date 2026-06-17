import { createClient } from '@supabase/supabase-js';

const TIER_ORDER: Record<string, number> = {
  free: 0,
  supporter: 1,
  insider: 2,
  patron: 3,
};

export function meetsTier(userTier: string, requiredTier: string): boolean {
  const userLevel = TIER_ORDER[userTier] ?? 0;
  const requiredLevel = TIER_ORDER[requiredTier] ?? 0;
  return userLevel >= requiredLevel;
}

export async function requireSubscription(
  jwt: string,
  requiredTier: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });

  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: 'Not authenticated', status: 401 };
  }

  const { data: sub } = await sb
    .from('user_subscriptions')
    .select('tier')
    .eq('user_id', user.id)
    .maybeSingle();

  const userTier = (sub?.tier as string) || 'free';
  if (!meetsTier(userTier, requiredTier)) {
    return { ok: false, error: 'Upgrade required', status: 403 };
  }

  return { ok: true };
}
