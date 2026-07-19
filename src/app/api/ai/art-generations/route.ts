import { NextRequest, NextResponse } from 'next/server';
import { resolveAiContext } from '../_lib/auth';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const ctx = await resolveAiContext(req);
  if (ctx.error === 'Not authenticated' || ctx.error === 'Invalid session') {
    return NextResponse.json({ error: ctx.error }, { status: 401 });
  }
  if (!ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') || '20')));
  const offset = (page - 1) * limit;

  const { data, error, count } = await sb
    .from('ai_art_generations')
    .select('*', { count: 'exact' })
    .eq('user_id', ctx.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generations: data, total: count, page, limit });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveAiContext(req);
  if (ctx.error === 'Not authenticated' || ctx.error === 'Invalid session') {
    return NextResponse.json({ error: ctx.error }, { status: 401 });
  }
  if (!ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  let body: {
    prompt: string;
    negativePrompt?: string;
    style?: string;
    aspectRatio?: string;
    denoisingStrength?: number;
    referenceUrls?: string[];
    resultUrl?: string;
    status?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const { data, error } = await sb
    .from('ai_art_generations')
    .insert({
      user_id: ctx.userId,
      prompt: body.prompt.trim(),
      negative_prompt: body.negativePrompt?.trim() || '',
      style: body.style || 'cyber-hive',
      aspect_ratio: body.aspectRatio || '1:1',
      denoising_strength: body.denoisingStrength ?? 0.75,
      reference_urls: body.referenceUrls || [],
      result_url: body.resultUrl || null,
      status: body.status || 'completed',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ generation: data });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveAiContext(req);
  if (ctx.error === 'Not authenticated' || ctx.error === 'Invalid session') {
    return NextResponse.json({ error: ctx.error }, { status: 401 });
  }
  if (!ctx.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization') || '';
  const jwt = authHeader.replace('Bearer ', '');
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  let body: { id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { error } = await sb
    .from('ai_art_generations')
    .delete()
    .eq('id', body.id)
    .eq('user_id', ctx.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
