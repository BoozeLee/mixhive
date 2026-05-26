import { NextRequest, NextResponse } from 'next/server'

const STYLE_PROMPTS: Record<string, string> = {
  'cyber-hive':
    'A striking DJ portrait with a dark cyber-aesthetic, glowing gold hexagon patterns, neon accents, and a sleek black background. The figure wears DJ headphones and is surrounded by a honeycomb motif. Digital art, ultra high detail, 4k.',
  minimal:
    'A clean, minimalist DJ avatar with a dark background, subtle gold line-art details, and a modern geometric style. Simple, bold, professional.',
  abstract:
    'An abstract representation of a DJ — swirling sound waves, golden frequency patterns, and rich dark purples and blacks. Dynamic, energetic, artistic.',
  neon:
    'A vibrant neon-lit DJ scene with electric gold and cyan highlights against a deep black background. Cyberpunk aesthetic, glowing edges, futuristic.',
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI generation not configured' }, { status: 503 })
  }

  let body: { prompt?: string; style?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const styleKey = (body.style && STYLE_PROMPTS[body.style]) ? body.style : 'cyber-hive'
  const basePrompt = STYLE_PROMPTS[styleKey]
  const userHint = body.prompt?.trim() ? ` Additional style: ${body.prompt.slice(0, 200)}.` : ''
  const finalPrompt = `${basePrompt}${userHint}`

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: finalPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url',
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return NextResponse.json({ error: (err as Record<string, unknown>)?.error ?? 'Generation failed' }, { status: res.status })
  }

  const result = await res.json() as { data: Array<{ url: string }> }
  const url = result.data?.[0]?.url
  if (!url) {
    return NextResponse.json({ error: 'No image returned' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
