import { NextRequest, NextResponse } from 'next/server';
import { resolveAiContext, noKeyResponse } from '../_lib/auth';

const STYLE_PROMPTS: Record<string, string> = {
  'cyber-hive':
    'A striking DJ portrait with a dark cyber-aesthetic, glowing gold hexagon patterns, neon accents, and a sleek black background. The figure wears DJ headphones and is surrounded by a honeycomb motif. Digital art, ultra high detail, 4k.',
  minimal:
    'A clean, minimalist DJ avatar with a dark background, subtle gold line-art details, and a modern geometric style. Simple, bold, professional.',
  abstract:
    'An abstract representation of a DJ — swirling sound waves, golden frequency patterns, and rich dark purples and blacks. Dynamic, energetic, artistic.',
  neon: 'A vibrant neon-lit DJ scene with electric gold and cyan highlights against a deep black background. Cyberpunk aesthetic, glowing edges, futuristic.',
};

export async function POST(req: NextRequest) {
  const ctx = await resolveAiContext(req);

  if (!ctx.openaiKey) {
    if (ctx.error === 'Not authenticated' || ctx.error === 'Invalid session') {
      return NextResponse.json({ error: ctx.error }, { status: 401 });
    }
    return noKeyResponse();
  }

  let body: { prompt?: string; style?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 'cosmic-funk' = the Profile Art Studio: the client sends a fully-compiled
  // recipe prompt (already includes the locked style core); pass it through at a
  // higher cap. Other styles keep the preset + short hint behaviour.
  let finalPrompt: string;
  if (body.style === 'cosmic-funk') {
    finalPrompt = (body.prompt?.trim() || '').slice(0, 3500);
    if (!finalPrompt) {
      return NextResponse.json({ error: 'Empty prompt' }, { status: 400 });
    }
  } else {
    const styleKey = body.style && STYLE_PROMPTS[body.style] ? body.style : 'cyber-hive';
    const basePrompt = STYLE_PROMPTS[styleKey];
    const userHint = body.prompt?.trim() ? ` Additional style: ${body.prompt.slice(0, 200)}.` : '';
    finalPrompt = `${basePrompt}${userHint}`;
  }

  // Input moderation (free OpenAI endpoint) — refuse flagged prompts before
  // spending the user's key. Best-effort: a moderation outage doesn't block.
  try {
    const modRes = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: finalPrompt }),
    });
    if (modRes.ok) {
      const mod = (await modRes.json()) as { results?: Array<{ flagged?: boolean }> };
      if (mod.results?.[0]?.flagged) {
        return NextResponse.json(
          { error: 'Your prompt was flagged by content moderation — please adjust it.' },
          { status: 400 }
        );
      }
    }
  } catch {
    /* moderation best-effort */
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.openaiKey}`,
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
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as Record<string, unknown>)?.error ?? 'Generation failed' },
      { status: res.status }
    );
  }

  const result = (await res.json()) as { data: Array<{ url: string }> };
  const url = result.data?.[0]?.url;
  if (!url) {
    return NextResponse.json({ error: 'No image returned' }, { status: 500 });
  }

  const imageRes = await fetch(url);
  if (!imageRes.ok) {
    return NextResponse.json(
      { error: 'Could not retrieve generated image' },
      { status: imageRes.status }
    );
  }

  const contentType = imageRes.headers.get('content-type') || 'image/png';
  const imageBuffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');

  return NextResponse.json({ url: `data:${contentType};base64,${base64}` });
}
