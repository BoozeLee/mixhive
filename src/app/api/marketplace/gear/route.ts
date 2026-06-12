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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const country = searchParams.get('country');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '24', 10), 50);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    const sb = makeClient();
    let q = sb
      .from('equipment_listings')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      // Boosted listings surface first while their window is active.
      .order('boosted_until', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (category) q = q.eq('category', category);
    if (condition) q = q.eq('condition', condition);
    if (country) q = q.eq('location_country', country);
    if (minPrice) q = q.gte('price', parseFloat(minPrice));
    if (maxPrice) q = q.lte('price', parseFloat(maxPrice));

    const { data, error, count } = await q;
    if (error) throw error;

    return NextResponse.json({ listings: data ?? [], total: count ?? 0, offset, limit });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    // Gate publishing on a working payout account so sellers can actually be paid.
    const { data: profile } = await sb
      .from('profiles')
      .select('payouts_enabled')
      .eq('id', user.id)
      .single();
    if (!profile?.payouts_enabled) {
      return NextResponse.json(
        { error: 'Set up payouts before listing gear for sale', code: 'payouts_required' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      title,
      description,
      category,
      brand,
      model,
      condition,
      price,
      currency,
      location_city,
      location_country,
      photos,
      shipping_options,
      preferred_payment,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 });
    if (!condition) return NextResponse.json({ error: 'Condition required' }, { status: 400 });
    if (price == null || price < 0)
      return NextResponse.json({ error: 'Price required' }, { status: 400 });
    if (!photos?.length)
      return NextResponse.json({ error: 'At least one photo required' }, { status: 400 });

    const { data, error } = await sb
      .from('equipment_listings')
      .insert({
        seller_profile_id: user.id,
        title: title.trim(),
        description,
        category,
        brand,
        model,
        condition,
        price,
        currency: currency ?? 'EUR',
        location_city,
        location_country,
        photos,
        shipping_options: shipping_options ?? {
          local_pickup: true,
          domestic_shipping: false,
          international_shipping: false,
        },
        preferred_payment: preferred_payment ?? [],
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ listing: data }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
