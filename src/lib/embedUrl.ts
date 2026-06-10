// Map a portfolio/social URL to a rich embed (provider iframe) or a link card.
// Iframe-only embeds (no API keys / no paid oEmbed). Unknown or token-gated
// providers (Instagram, Behance, plain websites) fall back to a link card.
export type Embed =
  | { kind: 'iframe'; src: string; height: number; title: string }
  | { kind: 'link'; url: string; label: string };

export function toEmbed(rawUrl: string): Embed {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { kind: 'link', url: '#', label: rawUrl };
  }
  // Only ever surface http(s) URLs — never a javascript:/data:/vbscript: scheme
  // in an iframe src or a link href (social_links is user-controlled).
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { kind: 'link', url: '#', label: rawUrl };
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
    const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
      rawUrl
    )}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&visual=false`;
    return { kind: 'iframe', src, height: 166, title: 'SoundCloud' };
  }

  if (host === 'open.spotify.com') {
    const path = u.pathname.replace(/^\/(track|album|playlist|artist|episode|show)\//, '/embed/$1/');
    if (path.startsWith('/embed/')) {
      return { kind: 'iframe', src: `https://open.spotify.com${path}`, height: 152, title: 'Spotify' };
    }
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = u.searchParams.get('v');
    if (v) return { kind: 'iframe', src: `https://www.youtube.com/embed/${v}`, height: 200, title: 'YouTube' };
  }
  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '');
    if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}`, height: 200, title: 'YouTube' };
  }

  if (host === 'mixcloud.com') {
    const src = `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(rawUrl)}&hide_cover=1&mini=1`;
    return { kind: 'iframe', src, height: 120, title: 'Mixcloud' };
  }

  return { kind: 'link', url: rawUrl, label: host };
}
