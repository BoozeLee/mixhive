import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const keys = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const camelot = ['8B', '3B', '10B', '5B', '12B', '7B', '2B', '9B', '4B', '11B', '6B', '1B']

function hash(value: string) {
  return Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

function chooseMood(text: string) {
  const normalized = text.toLowerCase()
  if (/(industrial|hard|acid|peak|rave|techno)/.test(normalized)) return 'high-pressure'
  if (/(ambient|downtempo|deep|jazz|chill)/.test(normalized)) return 'immersive'
  if (/(house|disco|funk|groove)/.test(normalized)) return 'warm-groove'
  return 'underground-club'
}

function buildStructure(duration: number | null, energy: number) {
  const total = Math.max(duration || 1800, 300)
  const cuts = [
    ['intro', 0, Math.round(total * 0.12), Math.max(0.2, energy - 0.28)],
    ['build', Math.round(total * 0.12), Math.round(total * 0.38), Math.max(0.35, energy - 0.12)],
    ['peak', Math.round(total * 0.38), Math.round(total * 0.72), energy],
    ['release', Math.round(total * 0.72), Math.round(total * 0.9), Math.max(0.35, energy - 0.18)],
    ['outro', Math.round(total * 0.9), total, Math.max(0.25, energy - 0.3)],
  ] as const
  return {
    summary: 'Rule-based preview until Essentia/AudD processing is connected.',
    sections: cuts.map(([label, start_sec, end_sec, sectionEnergy]) => ({
      label,
      start_sec,
      end_sec,
      energy: Number(sectionEnergy.toFixed(2)),
    })),
  }
}

function requireSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) return null
  return { supabaseUrl, supabaseAnonKey }
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42P01' || /Could not find the table/i.test(error?.message || '')
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mixId: string }> },
) {
  const env = requireSupabase()
  if (!env) return NextResponse.json({ feature: null, tracks: [], setup_required: true })
  const { mixId } = await params
  const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } })

  const { data: feature, error } = await sb
    .from('audio_features')
    .select('*')
    .eq('mix_id', mixId)
    .maybeSingle()

  if (isMissingTable(error)) {
    return NextResponse.json({
      feature: null,
      tracks: [],
      setup_required: true,
      message: 'audio_features migration has not been applied yet.',
    })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: tracks, error: tracksError } = await sb
    .from('mix_tracks')
    .select('*')
    .eq('mix_id', mixId)
    .order('start_sec', { ascending: true })

  if (tracksError && tracksError.code !== '42P01') {
    return NextResponse.json({ error: tracksError.message }, { status: 500 })
  }

  return NextResponse.json({ feature, tracks: tracks ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mixId: string }> },
) {
  const env = requireSupabase()
  if (!env) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { mixId } = await params
  const jwt = authHeader.slice(7)
  const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })

  const { data: { user }, error: authError } = await sb.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

  const { data: mix, error: mixError } = await sb
    .from('mixes')
    .select('id, dj_id, title, description, tags, duration_seconds')
    .eq('id', mixId)
    .single()

  if (mixError || !mix) return NextResponse.json({ error: 'Mix not found' }, { status: 404 })
  if (mix.dj_id !== user.id) return NextResponse.json({ error: 'Only the mix owner can analyze this mix' }, { status: 403 })

  const seed = hash(`${mix.id}:${mix.title}`)
  const text = [mix.title, mix.description, ...(mix.tags || [])].filter(Boolean).join(' ')
  const keyIndex = seed % keys.length
  const bpm = 118 + (seed % 30)
  const energy = Number((0.55 + ((seed % 36) / 100)).toFixed(2))
  const payload = {
    mix_id: mix.id,
    status: 'complete',
    bpm,
    musical_key: `${keys[keyIndex]} minor`,
    camelot: camelot[keyIndex],
    mood: chooseMood(text),
    energy,
    danceability: Number(Math.min(0.96, energy + 0.08).toFixed(2)),
    structure_json: buildStructure(mix.duration_seconds, energy),
    source: 'mixhive-rule-v1',
    model: 'deterministic-preview',
    confidence: 0.42,
    error_message: null,
  }

  const { data: feature, error } = await sb
    .from('audio_features')
    .upsert(payload, { onConflict: 'mix_id' })
    .select()
    .single()

  if (isMissingTable(error)) {
    return NextResponse.json({
      error: 'audio_intelligence_storage_not_ready',
      message: 'Run Supabase migrations before storing audio analysis.',
    }, { status: 503 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ feature, tracks: [] })
}
