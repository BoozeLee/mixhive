'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AVATAR_BUCKET, hasUserAiKey } from '../lib/api';
import {
  compileRecipe,
  CHARACTERS,
  THEMES,
  OBJECTS,
  PALETTE,
  type ArtRecipe,
} from '../lib/cosmicFunkPrompt';
import { colors, space, radius, fontSize, fontWeight } from '../styles/tokens';
import { Input } from './ui/Input';
import { HiveButton } from './hive/HiveButton';

const SWATCH: Record<string, string> = {
  'electric purple': '#8b2fd6',
  'acid green': '#7CFC00',
  'hot pink': '#ff3d9a',
  'cosmic blue': '#2b6bff',
  'bright orange': '#ff7a18',
  'yellow gold': '#f0c040',
  magenta: '#d6249f',
  'blacklight teal': '#1fd3c3',
};

function Chip({
  label,
  active,
  onClick,
  swatch,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space[3],
        padding: '8px 14px',
        minHeight: 40,
        borderRadius: radius.pill,
        border: `1px solid ${active ? colors.accent : colors.border}`,
        background: active ? colors.accentFaint : colors.surface,
        color: active ? colors.accent : colors.text.secondary,
        fontSize: fontSize.sm,
        fontWeight: active ? fontWeight.semibold : fontWeight.medium,
        cursor: 'pointer',
        textTransform: 'capitalize',
      }}
    >
      {swatch && (
        <span
          style={{ width: 12, height: 12, borderRadius: 999, background: swatch, flex: 'none' }}
        />
      )}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: space[7] }}>
      <div
        style={{
          fontSize: fontSize.xs,
          color: colors.text.dim,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          marginBottom: space[4],
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>{children}</div>
    </div>
  );
}

export function ProfileArtStudio({
  defaultName,
  onAvatarSet,
}: {
  defaultName?: string;
  onAvatarSet?: (url: string) => void;
}) {
  const { user, profile } = useAuth();
  const [recipe, setRecipe] = useState<ArtRecipe>({
    mode: 'avatar',
    subjectName: defaultName || profile?.display_name || profile?.username || 'My Artist Name',
    character: 'DJ',
    theme: 'cosmic funk',
    objects: ['disco ball', 'planets', 'stars'],
    palette: ['electric purple', 'acid green', 'hot pink'],
    head: '',
    outfit: '',
    expression: '',
    intensity: 50,
    freeText: '',
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [aiKeyReady, setAiKeyReady] = useState<'loading' | 'none' | 'ready'>('loading');
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setAiKeyReady('none');
      return;
    }
    hasUserAiKey(user.id)
      .then(has => setAiKeyReady(has ? 'ready' : 'none'))
      .catch(() => setAiKeyReady('none'));
  }, [user]);

  const set = <K extends keyof ArtRecipe>(k: K, v: ArtRecipe[K]) =>
    setRecipe(p => ({ ...p, [k]: v }));
  const toggleIn = (k: 'objects' | 'palette', v: string) =>
    setRecipe(p => {
      const list = p[k];
      return { ...p, [k]: list.includes(v) ? list.filter(x => x !== v) : [...list, v] };
    });

  const prompt = useMemo(() => {
    try {
      return compileRecipe(recipe);
    } catch {
      return '';
    }
  }, [recipe]);

  async function generate() {
    if (!user || generating) return;
    setError(null);
    setGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch('/api/ai/generate-avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ style: 'cosmic-funk', prompt }),
      });
      if (res.status === 402 || res.status === 403) {
        setAiKeyReady('none');
        setError('Add your own OpenAI key in Settings to generate art.');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Generation failed.');
        return;
      }
      if (data.url) setResults(prev => [data.url, ...prev]);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function setAsAvatar(dataUrl: string) {
    if (!user || !isSupabaseConfigured) return;
    setSavingUrl(dataUrl);
    setError(null);
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `${user.id}/avatar_cosmic_${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);
      if (updErr) throw updErr;
      setSavedUrl(dataUrl);
      onAvatarSet?.(publicUrl);
    } catch {
      setError('Could not set that as your profile picture.');
    } finally {
      setSavingUrl(null);
    }
  }

  return (
    <div style={{ display: 'grid', gap: space[8] }}>
      <header>
        <h2
          style={{
            margin: 0,
            fontSize: fontSize['2xl'],
            fontWeight: fontWeight.bold,
            color: colors.text.primary,
          }}
        >
          Design your artist identity
        </h2>
        <p style={{ margin: `${space[2]}px 0 0`, color: colors.text.dim, fontSize: fontSize.sm }}>
          A psychedelic cosmic-funk avatar, generated from a few choices. Square, face-first —
          perfect for your profile.
        </p>
      </header>

      <Field label="Artist name">
        <Input
          value={recipe.subjectName}
          onChange={e => set('subjectName', e.target.value)}
          placeholder="DJ Nefke"
          style={{ maxWidth: 320 }}
        />
      </Field>

      <Field label="Character">
        {CHARACTERS.map(c => (
          <Chip
            key={c}
            label={c}
            active={recipe.character === c}
            onClick={() => set('character', c)}
          />
        ))}
      </Field>

      <Field label="Theme">
        {THEMES.map(t => (
          <Chip key={t} label={t} active={recipe.theme === t} onClick={() => set('theme', t)} />
        ))}
      </Field>

      <Field label="Surround me with (pick a few)">
        {OBJECTS.map(o => (
          <Chip
            key={o}
            label={o}
            active={recipe.objects.includes(o)}
            onClick={() => toggleIn('objects', o)}
          />
        ))}
      </Field>

      <Field label="Colors">
        {PALETTE.map(p => (
          <Chip
            key={p}
            label={p}
            swatch={SWATCH[p] ?? colors.borderStrong}
            active={recipe.palette.includes(p)}
            onClick={() => toggleIn('palette', p)}
          />
        ))}
      </Field>

      <div style={{ marginBottom: space[2] }}>
        <div
          style={{
            fontSize: fontSize.xs,
            color: colors.text.dim,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: space[3],
          }}
        >
          Vibe — more cosmic ⟷ more funky
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={recipe.intensity}
          onChange={e => set('intensity', Number(e.target.value))}
          style={{ width: '100%', maxWidth: 420, accentColor: colors.accent }}
          aria-label="Cosmic to funky intensity"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(s => !s)}
        style={{
          background: 'none',
          border: 'none',
          color: colors.accent,
          fontSize: fontSize.sm,
          cursor: 'pointer',
          textAlign: 'left',
          padding: 0,
        }}
      >
        {showAdvanced ? '− Hide' : '+ Advanced'} (head/outfit, extra details)
      </button>
      {showAdvanced && (
        <div style={{ display: 'grid', gap: space[6], maxWidth: 480 }}>
          <Input
            label="Head details"
            value={recipe.head ?? ''}
            onChange={e => set('head', e.target.value)}
            placeholder="bald with glowing headphones, cracked helmet…"
          />
          <Input
            label="Outfit"
            value={recipe.outfit ?? ''}
            onChange={e => set('outfit', e.target.value)}
            placeholder="striped pirate coat, toga, space suit…"
          />
          <Input
            label="Expression"
            value={recipe.expression ?? ''}
            onChange={e => set('expression', e.target.value)}
            placeholder="confident, mischievous…"
          />
          <Input
            label="Anything else (optional)"
            value={recipe.freeText ?? ''}
            onChange={e => set('freeText', e.target.value)}
            placeholder="extra surreal details"
          />
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowPrompt(s => !s)}
          style={{
            background: 'none',
            border: 'none',
            color: colors.text.dim,
            fontSize: fontSize.xs,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showPrompt ? 'Hide' : 'Preview'} the exact prompt
        </button>
        {showPrompt && (
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: space[5],
              fontSize: fontSize.xs,
              color: colors.text.secondary,
              marginTop: space[3],
            }}
          >
            {prompt}
          </pre>
        )}
      </div>

      {aiKeyReady === 'none' && (
        <div
          style={{
            background: colors.accentFaint,
            border: `1px solid ${colors.accentMuted}`,
            borderRadius: radius.md,
            padding: space[6],
            fontSize: fontSize.sm,
            color: colors.text.secondary,
          }}
        >
          AI art uses your own OpenAI key (~$0.04 / image, billed to you).{' '}
          <Link to="/settings" style={{ color: colors.accent, fontWeight: fontWeight.semibold }}>
            Add your key in Settings →
          </Link>
        </div>
      )}
      {error && <div style={{ color: colors.danger, fontSize: fontSize.sm }}>{error}</div>}

      <div style={{ display: 'flex', gap: space[5], alignItems: 'center', flexWrap: 'wrap' }}>
        <HiveButton
          variant="primary"
          size="lg"
          onClick={generate}
          disabled={generating || aiKeyReady === 'none' || !recipe.subjectName.trim()}
        >
          {generating ? 'Generating…' : '✨ Generate avatar'}
        </HiveButton>
        {generating && (
          <span style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
            DALL·E is painting… ~15s
          </span>
        )}
      </div>

      {results.length > 0 && (
        <div>
          <div
            style={{
              fontSize: fontSize.xs,
              color: colors.text.dim,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: space[4],
            }}
          >
            Results
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: space[6],
            }}
          >
            {results.map((url, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${savedUrl === url ? colors.accent : colors.border}`,
                  borderRadius: radius.lg,
                  overflow: 'hidden',
                  background: colors.surface,
                }}
              >
                <img
                  src={url}
                  alt={`Generated avatar ${i + 1}`}
                  style={{
                    width: '100%',
                    aspectRatio: '1/1',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{ padding: space[4] }}>
                  <HiveButton
                    variant={savedUrl === url ? 'ghost' : 'primary'}
                    size="sm"
                    onClick={() => setAsAvatar(url)}
                    disabled={savingUrl === url}
                  >
                    {savedUrl === url
                      ? '✓ Profile picture'
                      : savingUrl === url
                        ? 'Saving…'
                        : 'Use as avatar'}
                  </HiveButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
