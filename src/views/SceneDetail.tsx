'use client';
import { useTranslations } from 'next-intl';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { colors, fontSize, radius, tierColors } from '../styles/tokens';
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
interface Listing {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  xp: number;
  reputation: number;
  badge: string;
  verified: boolean;
}
interface Partner {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  url: string | null;
  verified: boolean;
}

const BADGE_COLOR: Record<string, string> = tierColors;

export function SceneDetail() {
  const t = useTranslations('sceneDetail');
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [scene, setScene] = useState<Scene | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    fetch(`/api/scenes/${slug}`)
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        if (d.error) setError(d.error);
        else {
          setScene(d.scene);
          setListings(d.listings || []);
          setPartners(d.partners || []);
        }
      })
      .catch(e => active && setError(String(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <LoadingSpinner />
      </div>
    );
  }
  if (error || !scene) {
    return (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
        <p style={{ color: colors.text.dim }}>{error || t('sceneNotFound')}</p>
        <button
          onClick={() => navigate('/scenes')}
          style={{ marginTop: 12, color: colors.text.secondary }}
        >
          {t('allScenes')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <button
        onClick={() => navigate('/scenes')}
        style={{
          color: colors.text.dim,
          fontSize: fontSize.sm,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {t('allScenes')}
      </button>

      <div
        style={{
          marginTop: 12,
          padding: 24,
          borderRadius: radius.lg,
          background: scene.hero_image_url
            ? `url(${scene.hero_image_url}) center/cover`
            : colors.surface,
          border: `1px solid ${colors.border}`,
        }}
      >
        <h1 style={{ fontSize: fontSize['3xl'], fontWeight: 700, color: colors.text.primary }}>
          {scene.name}
        </h1>
        <div style={{ fontSize: fontSize.sm, color: colors.text.dim, marginTop: 4 }}>
          {[scene.city, scene.country].filter(Boolean).join(', ')}
          {scene.genre ? ` · ${scene.genre}` : ''}
        </div>
        {scene.description && (
          <p
            style={{
              fontSize: fontSize.md,
              color: colors.text.secondary,
              marginTop: 12,
              maxWidth: 640,
            }}
          >
            {scene.description}
          </p>
        )}
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: fontSize.xl, fontWeight: 600, color: colors.text.primary }}>
          {t('activeArtists')}
        </h2>
        {listings.length === 0 ? (
          <p style={{ color: colors.text.dim, fontSize: fontSize.sm, marginTop: 8 }}>
            {t('noArtistsYet')}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12, display: 'grid', gap: 8 }}>
            {listings.map(a => (
              <li key={a.user_id}>
                <button
                  type="button"
                  disabled={!a.username}
                  onClick={() => a.username && navigate(`/u/${a.username}`)}
                  style={{
                    width: '100%',
                    font: 'inherit',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    cursor: a.username ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ color: colors.text.primary, fontSize: fontSize.md }}>
                    {a.display_name || a.username || 'Unknown'}
                    {a.verified ? ' ✓' : ''}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: fontSize.xs, color: colors.text.dim }}>
                      {t('xp', { count: a.xp })}
                    </span>
                    <span
                      style={{
                        fontSize: fontSize.xs,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        color: BADGE_COLOR[a.badge] || colors.text.muted,
                      }}
                    >
                      {a.badge}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {partners.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: fontSize.xl, fontWeight: 600, color: colors.text.primary }}>
            {t('labelPartners')}
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
            {partners.map(p => (
              <a
                key={p.id}
                href={p.url || undefined}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: '8px 14px',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: radius.md,
                  color: colors.text.primary,
                  fontSize: fontSize.sm,
                  textDecoration: 'none',
                }}
              >
                {p.name}
                {p.verified ? ' ✓' : ''}
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
