'use client';
import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { colors, fontSize, radius } from '../styles/tokens';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface Scene {
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  genre: string | null;
  description: string | null;
  hero_image_url: string | null;
}

export function Scenes() {
  const t = useTranslations('scenes');
  const navigate = useNavigate();
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/scenes')
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        if (d.error) setError(d.error);
        else setScenes(d.scenes || []);
      })
      .catch(e => active && setError(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: fontSize['3xl'], fontWeight: 700, color: colors.text.primary }}>
        {t('scenes')}
      </h1>
      <p style={{ color: colors.text.dim, fontSize: fontSize.sm, marginTop: 4 }}>
        Local underground communities — artists, labels and collectives.
      </p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <LoadingSpinner />
        </div>
      ) : error ? (
        <p style={{ color: colors.text.dim, marginTop: 24 }}>Could not load scenes: {error}</p>
      ) : scenes.length === 0 ? (
        <p style={{ color: colors.text.dim, marginTop: 24 }}>{t('noScenesYet')}</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 16,
            marginTop: 24,
          }}
        >
          {scenes.map(s => (
            <button
              key={s.slug}
              onClick={() => navigate(`/scene/${s.slug}`)}
              style={{
                textAlign: 'left',
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                padding: 16,
                cursor: 'pointer',
                color: colors.text.primary,
              }}
            >
              <div style={{ fontSize: fontSize.lg, fontWeight: 600 }}>{s.name}</div>
              <div style={{ fontSize: fontSize.xs, color: colors.text.dim, marginTop: 2 }}>
                {[s.city, s.country].filter(Boolean).join(', ')}
                {s.genre ? ` · ${s.genre}` : ''}
              </div>
              {s.description && (
                <p style={{ fontSize: fontSize.sm, color: colors.text.secondary, marginTop: 8 }}>
                  {s.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
