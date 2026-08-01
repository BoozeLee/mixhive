// Cron: voids Flow Key drains left open longer than 15 minutes and closes their
// taps. A session must never be left with a stuck-open key.
// Called by the Vercel scheduler. Auth: Authorization: Bearer $CRON_SECRET.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data, error } = await sb.rpc('reap_stale_flow_drains');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ voided: data ?? 0 });
}
