import { toEmbed } from '../lib/embedUrl';

describe('toEmbed', () => {
  it('maps SoundCloud to a player iframe', () => {
    const e = toEmbed('https://soundcloud.com/artist/track');
    expect(e.kind).toBe('iframe');
    if (e.kind === 'iframe') expect(e.src).toContain('w.soundcloud.com/player');
  });

  it('maps a Spotify track to the embed iframe', () => {
    const e = toEmbed('https://open.spotify.com/track/abc123');
    expect(e.kind).toBe('iframe');
    if (e.kind === 'iframe') expect(e.src).toBe('https://open.spotify.com/embed/track/abc123');
  });

  it('maps a YouTube watch URL to /embed', () => {
    const e = toEmbed('https://www.youtube.com/watch?v=XYZ987');
    expect(e.kind).toBe('iframe');
    if (e.kind === 'iframe') expect(e.src).toContain('/embed/XYZ987');
  });

  it('maps youtu.be short links', () => {
    const e = toEmbed('https://youtu.be/abc');
    expect(e.kind).toBe('iframe');
  });

  it('falls back to a link for Instagram', () => {
    expect(toEmbed('https://instagram.com/user').kind).toBe('link');
  });

  it('falls back to a link for invalid URLs', () => {
    expect(toEmbed('not a url').kind).toBe('link');
  });

  it('neutralizes dangerous schemes (no javascript:/data: in href)', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,<script>1</script>', 'vbscript:msgbox']) {
      const e = toEmbed(bad);
      expect(e.kind).toBe('link');
      if (e.kind === 'link') expect(e.url).toBe('#');
    }
  });
});
