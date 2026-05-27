import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAiContext } from '../../_lib/auth'

interface SuggestionAction {
  action: 'apply' | 'reject' | 'rate'
  rating?: number
  comment?: string
  outcome?: 'used' | 'modified' | 'ignored'
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ctx = await resolveAiContext(req)

  if (!ctx.userId) {
    return NextResponse.json({ error: ctx.error ?? 'Not authenticated' }, { status: 401 })
  }

  let body: SuggestionAction
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!['apply', 'reject', 'rate'].includes(body.action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const authHeader = req.headers.get('authorization')!
  const jwt = authHeader.slice(7)

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })

  if (body.action === 'apply') {
    const { data, error } = await sb
      .from('ai_suggestions')
      .update({ status: 'applied', applied_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
    return NextResponse.json({ suggestion: data })
  }

  if (body.action === 'reject') {
    const { data, error } = await sb
      .from('ai_suggestions')
      .update({ status: 'rejected', rejected_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', ctx.userId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
    return NextResponse.json({ suggestion: data })
  }

  // rate
  if (!body.rating || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'rating must be 1–5' }, { status: 400 })
  }

  const { data, error } = await sb
    .from('ai_feedback')
    .insert({
      suggestion_id: id,
      owner_id: ctx.userId,
      rating: body.rating,
      comment: body.comment ?? null,
      outcome: body.outcome ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ feedback: data })
}
