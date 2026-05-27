import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveAiContext, noKeyResponse } from '../_lib/auth'

export async function POST(req: NextRequest) {
  const ctx = await resolveAiContext(req)

  if (!ctx.userId) {
    return NextResponse.json({ error: ctx.error ?? 'Not authenticated' }, { status: 401 })
  }
  if (!ctx.openaiKey) {
    return noKeyResponse()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const authHeader = req.headers.get('authorization')!
  const jwt = authHeader.slice(7)

  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  })

  // Fetch profile data to build the coaching prompt
  const { data: profile } = await sb
    .from('profiles')
    .select('display_name, bio, genres, location, dj_equipment, dj_daw, dj_style, is_dj')
    .eq('id', ctx.userId)
    .single()

  const { count: mixCount } = await sb
    .from('mixes')
    .select('id', { count: 'exact', head: true })
    .eq('dj_id', ctx.userId)
    .eq('published', true)

  const profileLines: string[] = []
  if (profile?.display_name) profileLines.push(`Name: ${profile.display_name}`)
  if (profile?.bio) profileLines.push(`Current bio: ${profile.bio}`)
  if (profile?.genres?.length) profileLines.push(`Genres: ${profile.genres.join(', ')}`)
  if (profile?.location) profileLines.push(`Location: ${profile.location}`)
  if (profile?.dj_style) profileLines.push(`Style: ${profile.dj_style}`)
  if (profile?.dj_equipment?.length) profileLines.push(`Equipment: ${profile.dj_equipment.join(', ')}`)
  if (profile?.dj_daw?.length) profileLines.push(`DAW/software: ${profile.dj_daw.join(', ')}`)
  if (mixCount != null) profileLines.push(`Published mixes: ${mixCount}`)

  const systemPrompt = `You are the Profile Coach for MixHive, an AI manager for underground music creators in Belgium and Europe.
Analyse the creator's profile and return a JSON object with exactly this structure:
{
  "score": <integer 0-100, overall profile completeness/bookability>,
  "headline": "<2–4 word summary of profile strength>",
  "suggestions": [
    {
      "field": "<bio|genres|location|equipment|style|mixes|links>",
      "issue": "<one sentence: what is missing or weak>",
      "suggestion": "<one sentence: specific actionable improvement>",
      "priority": <1=critical, 2=important, 3=nice-to-have>
    }
  ],
  "bio_rewrite": "<optional: 2–3 sentence rewritten bio in first person, only if bio exists and can be improved significantly, otherwise null>",
  "rationale": "<2–3 sentences: overall assessment of what makes this profile strong or weak for booking/collaboration in the Belgian underground scene>"
}
Return only valid JSON. No markdown. No commentary outside the JSON object.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: profileLines.join('\n') || 'New creator, no profile data yet.' },
      ],
      max_tokens: 800,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: (err as Record<string, unknown>)?.error ?? 'GPT request failed' }, { status: res.status })
  }

  const gptResult = await res.json() as { choices: Array<{ message: { content: string } }> }
  const rawContent = gptResult.choices?.[0]?.message?.content?.trim()
  if (!rawContent) {
    return NextResponse.json({ error: 'No content returned from GPT' }, { status: 500 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawContent)
  } catch {
    return NextResponse.json({ error: 'GPT returned invalid JSON', raw: rawContent }, { status: 500 })
  }

  const rationale = (payload.rationale as string | undefined) ?? null
  const confidence = typeof payload.score === 'number' ? payload.score / 100 : null

  const { data: suggestion, error: insertErr } = await sb
    .from('ai_suggestions')
    .insert({
      owner_id: ctx.userId,
      suggestion_type: 'profile_coach',
      payload,
      rationale,
      confidence,
      source: 'gpt',
      model: 'gpt-4o-mini',
      status: 'pending',
    })
    .select()
    .single()

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to store suggestion', detail: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ suggestion })
}
