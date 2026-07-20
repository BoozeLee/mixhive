import { NextRequest, NextResponse } from 'next/server';
import { resolveAiContext } from '../_lib/auth';

const HF_MODEL = 'stabilityai/stable-diffusion-xl-base-1.0';
const HF_API = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

const STYLE_SEEDS: Record<string, string> = {
  'cyber-hive':
    'dark cyberpunk, glowing gold hexagon patterns, honeycomb, neon accents, ultra high detail',
  cinematic: 'cinematic film still, dramatic lighting, anamorphic lens, film grain, depth of field',
  neon: 'neon-lit cyberpunk scene, electric gold and cyan, deep black, futuristic glow',
  abstract: 'abstract sound waves, golden frequencies, dark purple and black, dynamic energy',
  minimal: 'minimalist composition, dark background, gold geometric lines, clean modern aesthetic',
  cyberpunk: 'cyberpunk cityscape, neon signs, rain-slicked streets, holographic displays, gritty',
  anime: 'anime illustration, vibrant colors, dynamic composition, studio ghibli inspired',
  photorealistic: 'photorealistic portrait, natural lighting, sharp focus, 8k, ultra detailed',
};

const ASPECT_MAP: Record<string, string> = {
  '1:1': '1024x1024',
  '16:9': '1344x768',
  '9:16': '768x1344',
  '3:2': '1152x768',
  '2:3': '768x1152',
};

export async function POST(req: NextRequest) {
  const hfKey = process.env.HUGGINGFACE_API_KEY;
  if (!hfKey) {
    return NextResponse.json(
      { error: 'AI art not yet configured on this instance' },
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
        message: 'Upgrade to MixHive Pro to use the AI Art Studio.',
      },
      { status: 403 }
    );
  }

  let body: {
    prompt?: string;
    negativePrompt?: string;
    style?: string;
    aspectRatio?: string;
    denoisingStrength?: number;
    referenceImage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const styleKey = body.style && STYLE_SEEDS[body.style] ? body.style : 'cyber-hive';
  const styleSeed = STYLE_SEEDS[styleKey];
  const userPrompt = body.prompt?.trim().slice(0, 500) || '';
  const negativePrompt = body.negativePrompt?.trim().slice(0, 300) || '';

  const prompt = userPrompt
    ? `Masterpiece, best quality, ultra-detailed, 8k, ${userPrompt}, ${styleSeed}, highly detailed textures, intricate details, sharp focus`
    : `${styleSeed}, masterpiece, best quality, ultra-detailed, 8k, highly detailed textures, sharp focus`;

  const negativeDefault =
    'blurry, lowres, deformed, ugly, mutated hands, extra limbs, bad anatomy, watermark, text, logo, overexposed, underexposed, 3d render, plastic skin, artifacts, noise';
  const fullNegative = negativePrompt ? `${negativeDefault}, ${negativePrompt}` : negativeDefault;

  const size = ASPECT_MAP[body.aspectRatio || '1:1'] || '1024x1024';
  const denoising = Math.min(1, Math.max(0.3, body.denoisingStrength ?? 0.75));

  let payload: Record<string, unknown>;
  if (body.referenceImage) {
    const imgMatch = body.referenceImage.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!imgMatch) {
      return NextResponse.json({ error: 'Invalid reference image format' }, { status: 400 });
    }
    payload = {
      inputs: prompt,
      parameters: {
        negative_prompt: fullNegative,
        width: Number(size.split('x')[0]),
        height: Number(size.split('x')[1]),
        num_inference_steps: 50,
        guidance_scale: 7.5,
        strength: denoising,
        image: imgMatch[2],
      },
    };
  } else {
    payload = {
      inputs: prompt,
      parameters: {
        negative_prompt: fullNegative,
        width: Number(size.split('x')[0]),
        height: Number(size.split('x')[1]),
        num_inference_steps: 50,
        guidance_scale: 7.5,
      },
    };
  }

  const res = await fetch(HF_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfKey}`,
      'Content-Type': 'application/json',
      'x-wait-for-model': 'true',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ error: text || 'Generation failed' }, { status: res.status });
  }

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json()) as { error?: string; estimated_time?: number };
    if (json.error) {
      return NextResponse.json({ error: json.error }, { status: 500 });
    }
    if (json.estimated_time) {
      return NextResponse.json(
        {
          error: 'Model is loading, please retry in a moment',
          estimated_time: json.estimated_time,
        },
        { status: 503 }
      );
    }
  }

  const imageBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(imageBuffer).toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  return NextResponse.json({ url: dataUrl, prompt, style: styleKey });
}
