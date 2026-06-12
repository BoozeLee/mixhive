import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export async function ritualAuth(
  req: NextRequest
): Promise<{ sb: SupabaseClient; user: User } | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const sb = createClient(url, key, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error,
  } = await sb.auth.getUser();
  return error || !user ? null : { sb, user };
}

export async function ritualRateLimit(
  userId: string,
  action: string,
  limit: number,
  window: number
) {
  try {
    const { redisCache } = await import('@/lib/redis');
    const result = await redisCache.incrementRateLimit(`ritual:${action}:${userId}`, limit, window);
    return result.current <= limit;
  } catch {
    return true;
  }
}

export function normalizeVoteOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((option): option is string => typeof option === 'string')
    .map(option => option.trim())
    .filter(Boolean)
    .slice(0, 6);
}
