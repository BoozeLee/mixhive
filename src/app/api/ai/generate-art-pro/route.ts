import { NextRequest, NextResponse } from 'next/server';
import { resolveAiContext } from '../_lib/auth';

// MixHive Pro AI art — Stable Diffusion XL via Hugging Face Inference API.
// Uses the platform's HUGGINGFACE_API_KEY; never touches user's own OpenAI key.
// Swap HF_MODEL to any SDXL-compatible model ID without changing the API shape.
const HF_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const HF_API = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const STYLE_SEEDS: Record<string, string> = {
  'cyber-hive':
    'dark cyberpunk DJ, glowing gold hexagon patterns, honeycomb, neon, ultra high detail',
  minimal: 'minimalist DJ portrait, dark background, gold geometric lines, clean modern aesthetic',
  abstract: 'abstract sound waves, golden frequencies, dark purple and black, dynamic music art',
  neon: 'neon-lit DJ booth, electric gold and cyan, deep black, cyberpunk futuristic glow',
};

export async function POST(req: NextRequest) {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) {
    return NextResponse.json(
      { error: 'Pro AI art not yet configured on this instance' },
      { status: 503 }
    );
  }

  const ctx = await resolveAiContext(req);
  if (ctx.error === 'Not authenticated' || ctx.error === 'Invalid session') {
    return NextResponse.json({ error: ctx.error }, { status: 401 });
  }
  if (!ctx.isPro) {
    return NextResponse.json(
      {
        error: 'pro_required',
        message: 'Upgrade to MixHive Pro to use the built-in AI art generator.',
      },
      { status: 403 }
    );
  }

  let body: { prompt?: string; style?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const styleKey = body.style && STYLE_SEEDS[body.style] ? body.style : 'cyber-hive';
  const base = STYLE_SEEDS[styleKey];
  const extra = body.prompt?.trim() ? `, ${body.prompt.slice(0, 200)}` : '';
  const prompt = `${base}${extra}, high quality, 4k`;

  const res = await fetch(HF_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfKey}`,
      'Content-Type': 'application/json',
      'x-wait-for-model': 'true',
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ error: text || 'Generation failed' }, { status: res.status });
  }

  // HF returns raw image bytes
  const imageBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  return NextResponse.json({ url: dataUrl });
}
