import { createServerClient } from './supabase';

const PROVIDERS: Record<string, (url: string) => string | null> = {
  youtube: url => {
    const id = extractYouTubeId(url);
    return id
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
      : null;
  },
  soundcloud: url =>
    `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  spotify: url =>
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}&format=json`,
  mixcloud: url =>
    `https://www.mixcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`,
};

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m?.[1] ?? null;
}

function detectProvider(url: string): keyof typeof PROVIDERS | null {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/soundcloud\.com/.test(url)) return 'soundcloud';
  if (/spotify\.com/.test(url)) return 'spotify';
  if (/mixcloud\.com/.test(url)) return 'mixcloud';
  return null;
}

export interface OembedData {
  provider: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  html?: string;
  author_name?: string;
}

export async function fetchOembed(url: string): Promise<OembedData | null> {
  const provider = detectProvider(url);
  if (!provider) return null;

  const sb = createServerClient();
  const { data: cached } = await sb
    .from('oembed_cache')
    .select('*')
    .eq('url', url)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.cached_at).getTime() < 7 * 86400000) {
    return cached as OembedData;
  }

  const endpoint = PROVIDERS[provider](url);
  if (!endpoint) return null;

  try {
    const res = await fetch(endpoint, { headers: { Accept: 'application/json' } });
    if (!res.ok) return cached as OembedData | null;
    const json = await res.json();
    const data: OembedData = {
      provider,
      title: json.title,
      description: json.description,
      thumbnail_url: json.thumbnail_url,
      html: json.html,
      author_name: json.author_name,
    };
    await sb.from('oembed_cache').upsert({ url, ...data, cached_at: new Date().toISOString() });
    return data;
  } catch (err) {
    console.error('[oembed] fetch failed:', err);
    return cached as OembedData | null;
  }
}
