import { NextRequest, NextResponse } from 'next/server';
import { resolveAiContext, noKeyResponse } from '../_lib/auth';

export async function POST(req: NextRequest) {
  const ctx = await resolveAiContext(req);
  if (!ctx.openaiKey) {
    if (ctx.error === 'Not authenticated' || ctx.error === 'Invalid session') {
      return NextResponse.json({ error: ctx.error }, { status: 401 });
    }
    return noKeyResponse();
  }
  const apiKey = ctx.openaiKey;

  let body: { style?: string; influences?: string; equipment?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const lines: string[] = [];
  if (body.style) lines.push(`Style: ${body.style}`);
  if (body.influences) lines.push(`Influences: ${body.influences}`);
  if (body.equipment?.length) lines.push(`Equipment: ${body.equipment.join(', ')}`);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a music genre expert for a DJ social platform. Return a JSON array of 5 genre strings that best match the DJ described. Use short, standard genre names (e.g. "Techno", "Deep House", "Drum & Bass"). Output only valid JSON — no explanation, no markdown.',
        },
        { role: 'user', content: lines.join('\n') || 'A DJ' },
      ],
      max_tokens: 80,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: (err as Record<string, unknown>)?.error ?? 'Generation failed' },
      { status: res.status }
    );
  }

  const result = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = result.choices?.[0]?.message?.content?.trim();

  try {
    const parsed = JSON.parse(raw ?? '{}') as Record<string, unknown>;
    const genres = (parsed.genres ?? parsed.result ?? Object.values(parsed)[0]) as string[];
    return NextResponse.json({ genres: Array.isArray(genres) ? genres.slice(0, 5) : [] });
  } catch {
    return NextResponse.json({ genres: [] });
  }
}
