import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeClient(jwt?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key, {
    global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    auth: { persistSession: false },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const authHeader = req.headers.get('authorization');
    const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const sb = makeClient(jwt);

    const { data, error } = await sb.from('equipment_listings').select('*').eq('id', id).single();

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Increment view count (fire and forget)
    sb.from('equipment_listings')
      .update({ views_count: (data.views_count ?? 0) + 1 })
      .eq('id', id)
      .then(() => {});

    let transaction = null;
    if (jwt) {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (user) {
        const { data: txn } = await sb
          .from('equipment_transactions')
          .select('*')
          .eq('listing_id', id)
          .in('transaction_state', [
            'pending_payment',
            'paid_escrow',
            'shipped',
            'delivered',
            'disputed',
            'resolved',
          ])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (txn && (txn.buyer_profile_id === user.id || txn.seller_profile_id === user.id)) {
          transaction = txn;
        }
      }
    }

    return NextResponse.json({ listing: data, transaction });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const jwt = authHeader.slice(7);
    const sb = makeClient(jwt);

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const allowed = ['title', 'description', 'price', 'status', 'photos', 'shipping_options'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const { data, error } = await sb
      .from('equipment_listings')
      .update(update)
      .eq('id', id)
      .eq('seller_profile_id', user.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 });

    return NextResponse.json({ listing: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
