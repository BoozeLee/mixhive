import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function isAdmin(req: NextRequest): boolean {
  const h = req.headers.get('x-admin-secret') ?? '';
  return ADMIN_SECRET.length > 0 && h === ADMIN_SECRET;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const offset = (page - 1) * limit;
  const showBanned = searchParams.get('banned') === 'true';

  const sb = serviceClient();
  let dbQuery = sb
    .from('profiles')
    .select('*', { count: 'exact' });

  if (query) {
    dbQuery = dbQuery.or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%`
    );
  }

  if (showBanned) {
    dbQuery = dbQuery.eq('moderation_status', 'banned');
  }

  const { data: users, count, error } = await dbQuery
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ users: users || [], total: count || 0, page, limit });
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json();
  const { userId, action, reason } = body as {
    userId: string;
    action: 'ban' | 'unban';
    reason?: string;
  };

  if (!userId || !['ban', 'unban'].includes(action)) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const sb = serviceClient();

  if (action === 'ban') {
    const { error: updateError } = await sb
      .from('profiles')
      .update({
        moderation_status: 'banned',
        moderation_reason: reason || null,
      })
      .eq('id', userId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await sb.from('moderation_signals').insert({
      source_table: 'profiles',
      source_id: userId,
      signal_type: 'admin_ban',
      severity: 'high',
      action_taken: 'banned',
      flagged_by: 'admin',
      payload: { reason: reason || null },
    });
  } else {
    const { error: updateError } = await sb
      .from('profiles')
      .update({
        moderation_status: null,
        moderation_reason: null,
      })
      .eq('id', userId);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await sb.from('moderation_signals').insert({
      source_table: 'profiles',
      source_id: userId,
      signal_type: 'admin_unban',
      severity: 'low',
      action_taken: 'unbanned',
      flagged_by: 'admin',
      payload: { reason: reason || null },
    });
  }

  return NextResponse.json({ ok: true });
}