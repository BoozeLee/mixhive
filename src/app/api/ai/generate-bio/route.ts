import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI generation not configured' }, { status: 503 })
  }

  let body: {
    displayName?: string
    genres?: string[]
    equipment?: string[]
    daw?: string[]
    style?: string
    influences?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const lines: string[] = []
  if (body.displayName) lines.push(`DJ name: ${body.displayName}`)
  if (body.genres?.length) lines.push(`Genres: ${body.genres.join(', ')}`)
  if (body.equipment?.length) lines.push(`Equipment: ${body.equipment.join(', ')}`)
  if (body.daw?.length) lines.push(`Production software: ${body.daw.join(', ')}`)
  if (body.style) lines.push(`Style / vibe: ${body.style}`)
  if (body.influences) lines.push(`Influences: ${body.influences}`)

  const userContent = lines.join('\n') || 'A DJ on MixHive'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a copywriter for MixHive, a DJ and underground music social platform. Write a punchy, authentic 2-3 sentence bio for the DJ described below. Use first person ("I" or "My"). Keep it under 200 characters. No hashtags. No emojis. Capture their vibe and sound.',
        },
        { role: 'user', content: userContent },
      ],
      max_tokens: 120,
      temperature: 0.8,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: (err as Record<string, unknown>)?.error ?? 'Generation failed' }, { status: res.status })
  }

  const result = await res.json() as { choices: Array<{ message: { content: string } }> }
  const bio = result.choices?.[0]?.message?.content?.trim()
  if (!bio) {
    return NextResponse.json({ error: 'No bio returned' }, { status: 500 })
  }

  return NextResponse.json({ bio })
}
