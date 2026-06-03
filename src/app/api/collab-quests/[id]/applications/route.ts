// List applications for a quest (creator only) and manage role assignment.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient(jwt: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const sb = makeClient(authHeader.slice(7));

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    // Verify creator
    const { data: quest } = await sb.from('collab_quests').select('creator_profile_id').eq('id', id).single();
    if (!quest || quest.creator_profile_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data, error } = await sb
      .from('collab_quest_applications')
      .select('*, collab_roles(role_type, title)')
      .eq('quest_id', id)
      .order('applied_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ applications: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

// Accept or reject an application; accepting fills the role slot
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const sb = makeClient(authHeader.slice(7));

    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { application_id, decision } = await req.json();
    if (!application_id || !['accepted', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'application_id and decision (accepted|rejected) required' }, { status: 400 });
    }

    // Verify creator
    const { data: quest } = await sb.from('collab_quests').select('creator_profile_id').eq('id', id).single();
    if (!quest || quest.creator_profile_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Load application
    const { data: app, error: appErr } = await sb
      .from('collab_quest_applications')
      .select('*')
      .eq('id', application_id)
      .eq('quest_id', id)
      .single();
    if (appErr || !app) return NextResponse.json({ error: 'Application not found' }, { status: 404 });

    // Update application status
    await sb
      .from('collab_quest_applications')
      .update({ status: decision, decided_at: new Date().toISOString() })
      .eq('id', application_id);

    // If accepted: fill the role slot
    if (decision === 'accepted') {
      await sb
        .from('collab_roles')
        .update({ filled_by_profile_id: app.applicant_profile_id, status: 'filled' })
        .eq('id', app.role_id);

      // Reject all other pending applications for the same role
      await sb
        .from('collab_quest_applications')
        .update({ status: 'rejected', decided_at: new Date().toISOString() })
        .eq('role_id', app.role_id)
        .eq('status', 'pending')
        .neq('id', application_id);
    }

    return NextResponse.json({ ok: true, decision });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
