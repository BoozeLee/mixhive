import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const sb = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

  const { searchParams } = new URL(req.url)
  const city = searchParams.get('city')
  const genre = searchParams.get('genre')
  const type = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  let query = sb
    .from('opportunities')
    .select('*')
    .eq('is_active', true)
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (city) query = query.ilike('city', `%${city}%`)
  if (type) query = query.eq('opp_type', type)
  if (genre) query = query.contains('genres', [genre])

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ opportunities: data ?? [] })
}
