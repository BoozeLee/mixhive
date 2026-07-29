'use client';

import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { colors, fontSize, fontWeight, radius, space, withAlpha } from '../styles/tokens';
import { meetsTier } from '../lib/subscription';
import { ReferenceImageDropzone, type ReferenceImage } from '../components/ArtStudio/ReferenceImageDropzone';
import { PromptEditor, type ArtPromptState } from '../components/ArtStudio/PromptEditor';
import { ArtResultGrid, type ArtResult } from '../components/ArtStudio/ArtResultGrid';
import { ArtHistory } from '../components/ArtStudio/ArtHistory';
import { ARTWORK_BUCKET } from '../lib/api';

const DEFAULT_PROMPT: ArtPromptState = {
  prompt: '',
  negativePrompt: '',
  style: 'cyber-hive',
  aspectRatio: '1:1',
  denoisingStrength: 0.75,
  qualityDetail: true,
  qualitySharpness: false,
  qualityCinematic: false,
};

export function ArtStudio() {
  const t = useTranslations('artStudio');
  const { user } = useAuth();
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [promptState, setPromptState] = useState<ArtPromptState>(DEFAULT_PROMPT);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ArtResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingUrl, setSavingUrl] = useState<string | null>(null);

  const [userTier, setUserTier] = useState<string>('free');
  const [tierLoading, setTierLoading] = useState(false);

  const isPro = meetsTier(userTier, 'supporter');

  useEffect(() => {
    if (!user) {
      setUserTier('free');
      return;
    }
    setTierLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setUserTier('free');
        setTierLoading(false);
        return;
      }
      fetch('/api/subscription/status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).then(res => {
        if (!res.ok) {
          setUserTier('free');
          return;
        }
        res.json().then(data => {
          setUserTier(data.tier || 'free');
        });
      }).finally(() => {
        setTierLoading(false);
      });
    });
  }, [user]);

  const buildPrompt = useCallback(() => {
    const parts: string[] = ['Masterpiece, best quality, ultra-detailed, 8k'];
    if (promptState.prompt.trim()) {
      parts.push(promptState.prompt.trim());
    }
    if (promptState.qualityDetail) parts.push('highly detailed textures');
    if (promptState.qualitySharpness) parts.push('sharp focus, crystal clear');
    if (promptState.qualityCinematic) parts.push('cinematic lighting, volumetric fog');
    parts.push('depth of field');
    return parts.join(', ');
  }, [promptState]);

  const buildNegative = useCallback(() => {
    const base =
      'blurry, lowres, deformed, ugly, mutated hands, extra limbs, bad anatomy, watermark, text, logo, overexposed, underexposed, 3d render, plastic skin, artifacts, noise, jpeg compression';
    return promptState.negativePrompt.trim()
      ? `${base}, ${promptState.negativePrompt.trim()}`
      : base;
  }, [promptState]);

  async function generate() {
    if (!user || generating) return;
    setError(null);
    setGenerating(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Not authenticated');
        return;
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      };

      let res: Response;

      if (references.length > 0) {
        const refPayload = await Promise.all(
          references.map(async ref => {
            const blob = await fetch(ref.url).then(r => r.blob());
            const b64 = await new Promise<string>(resolve => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            return { data: b64, weight: ref.weight };
          })
        );

        res = await fetch('/api/ai/generate-art-mix', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prompt: buildPrompt(),
            negativePrompt: buildNegative(),
            style: promptState.style,
            aspectRatio: promptState.aspectRatio,
            denoisingStrength: promptState.denoisingStrength,
            references: refPayload,
          }),
        });
      } else {
        res = await fetch('/api/ai/generate-art', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prompt: buildPrompt(),
            negativePrompt: buildNegative(),
            style: promptState.style,
            aspectRatio: promptState.aspectRatio,
            denoisingStrength: promptState.denoisingStrength,
          }),
        });
      }

      if (res.status === 403) {
        setError('Upgrade to MixHive Pro to use AI Art Studio.');
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Generation failed.');
        return;
      }

      if (data.url) {
        setResults(prev => [
          { url: data.url, prompt: data.prompt || buildPrompt(), style: data.style || promptState.style },
          ...prev,
        ]);

        // Save to history
        try {
          await fetch('/api/ai/art-generations', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              prompt: data.prompt || buildPrompt(),
              negativePrompt: buildNegative(),
              style: promptState.style,
              aspectRatio: promptState.aspectRatio,
              denoisingStrength: promptState.denoisingStrength,
              resultUrl: data.url,
              status: 'completed',
            }),
          });
        } catch {
          // History save is non-critical
        }
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function useAsArtwork(url: string) {
    if (!user || !isSupabaseConfigured) return;
    setSavingUrl(url);
    try {
      const blob = await fetch(url).then(r => r.blob());
      const path = `${user.id}/art_studio_${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage
        .from(ARTWORK_BUCKET)
        .upload(path, blob, { contentType: 'image/png', upsert: true });
      if (upErr) throw upErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from(ARTWORK_BUCKET).getPublicUrl(path);

      setResults(prev =>
        prev.map(r => (r.url === url ? { ...r, saved: true, savedUrl: publicUrl } : r))
      );
    } catch {
      setError('Could not save artwork.');
    } finally {
      setSavingUrl(null);
    }
  }

  function downloadImage(url: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = `mixhive-art-${Date.now()}.png`;
    a.click();
  }

  return (
    <div
      className="container"
      style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px 80px' }}
    >
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <p
          style={{
            margin: '0 0 4px',
            fontSize: 11,
            fontWeight: 700,
            color: colors.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {t('title')}
        </p>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            color: colors.text.primary,
            lineHeight: 1.1,
          }}
        >
          {t('heading')}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.text.muted }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Pro badge or upgrade prompt */}
      {tierLoading ? (
        <div style={{ marginBottom: space[8], color: colors.text.dim, fontSize: fontSize.sm }}>
          Checking subscription…
        </div>
      ) : isPro ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: withAlpha(colors.successStrong, 0.1),
            border: `1px solid ${withAlpha(colors.successStrong, 0.3)}`,
            borderRadius: radius.md,
            fontSize: fontSize.sm,
            color: colors.successStrong,
            fontWeight: 600,
            marginBottom: space[8],
          }}
        >
          Stable Diffusion XL — Pro
        </div>
      ) : (
        <div
          style={{
            background: colors.accentFaint,
            border: `1px solid ${colors.accentMuted}`,
            borderRadius: radius.md,
            padding: space[5],
            fontSize: fontSize.sm,
            color: colors.text.secondary,
            marginBottom: space[8],
          }}
        >
          AI Art Studio requires MixHive Pro.{' '}
          <Link to="/pricing" style={{ color: colors.accent, fontWeight: fontWeight.semibold }}>
            Upgrade →
          </Link>
        </div>
      )}

      {/* Reference images */}
      <div style={{ marginBottom: space[8] }}>
        <ReferenceImageDropzone images={references} onImagesChange={setReferences} />
      </div>

      {/* Prompt editor */}
      <div style={{ marginBottom: space[8] }}>
        <PromptEditor value={promptState} onChange={setPromptState} />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            color: colors.danger,
            fontSize: fontSize.sm,
            marginBottom: space[6],
            padding: space[4],
            background: colors.dangerBg,
            borderRadius: radius.md,
            border: `1px solid ${withAlpha(colors.danger, 0.27)}`,
          }}
        >
          {error}
        </div>
      )}

      {/* Generate button */}
      <div style={{ display: 'flex', gap: space[5], alignItems: 'center', flexWrap: 'wrap', marginBottom: space[8] }}>
        <button
          type="button"
          onClick={generate}
          disabled={generating || !isPro}
          style={{
            padding: '12px 24px',
            background: colors.accentBright,
            color: colors.black,
            border: 'none',
            borderRadius: radius.lg,
            fontSize: fontSize.md,
            fontWeight: 700,
            cursor: generating || !isPro ? 'not-allowed' : 'pointer',
            opacity: generating || !isPro ? 0.5 : 1,
          }}
        >
          {generating ? 'Generating…' : t('generate')}
        </button>
        {generating && (
          <span style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
            SDXL is painting… ~20s
          </span>
        )}
      </div>

      {/* Results */}
      <ArtResultGrid
        results={results}
        onUseAsArtwork={useAsArtwork}
        onDownload={downloadImage}
        saving={savingUrl}
      />

      {/* History */}
      <div style={{ marginTop: space[10] }}>
        <ArtHistory />
      </div>
    </div>
  );
}
