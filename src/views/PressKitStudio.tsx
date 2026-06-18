import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../components/ui/Icon';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { PressKit } from '../lib/types';
import { useAuth } from '../hooks/useAuth';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

async function authHeaders(): Promise<HeadersInit | null> {
  if (!isSupabaseConfigured) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export function PressKitStudio() {
  const t = useTranslations('pressKitStudio');
  const { profile } = useAuth();
  const [kits, setKits] = useState<PressKit[]>([]);
  const [active, setActive] = useState<PressKit | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    authHeaders()
      .then(headers => {
        if (!headers) return [];
        return fetch('/api/epk', { headers }).then(async response => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || 'Unable to load press kits');
          return body.press_kits as PressKit[];
        });
      })
      .then(nextKits => {
        if (!alive) return;
        setKits(nextKits);
        setActive(nextKits[0] || null);
      })
      .catch(err => {
        if (alive) setError(err instanceof Error ? err.message : 'Unable to load press kits');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!headers) throw new Error('Sign in again to generate an EPK');
      const response = await fetch('/api/epk', {
        method: 'POST',
        headers,
        body: JSON.stringify({ publish: true }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'EPK generation failed');
      const nextKit = body.press_kit as PressKit;
      setActive(nextKit);
      setKits(prev => [nextKit, ...prev.filter(kit => kit.id !== nextKit.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'EPK generation failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: `${space[9]}px ${space[8]}px ${space[12]}px`,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: space[8],
          flexWrap: 'wrap',
          marginBottom: space[9],
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <p
            style={{
              margin: `0 0 ${space[3]}px`,
              color: colors.accent,
              fontSize: fontSize.xs,
              fontWeight: fontWeight.bold,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}
          >
            {t('pressKitAgent')}
          </p>
          <h1
            style={{
              margin: 0,
              color: colors.text.primary,
              fontSize: fontSize['3xl'],
              fontWeight: fontWeight.bold,
              lineHeight: 1.1,
            }}
          >
            {t('generateYourBookingReady')}
          </h1>
          <p
            style={{
              margin: `${space[4]}px 0 0`,
              color: colors.text.muted,
              fontSize: fontSize.base,
              lineHeight: 1.6,
            }}
          >
            {t('pressKitDescription')}
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          style={{
            border: `1px solid ${colors.accent}`,
            borderRadius: radius.md,
            background: generating
              ? colors.border
              : `linear-gradient(135deg, ${colors.accentBrightest}, ${colors.accent})`,
            color: generating ? colors.text.faint : colors.bg,
            padding: `${space[4]}px ${space[7]}px`,
            fontWeight: fontWeight.bold,
            textTransform: 'uppercase',
            cursor: generating ? 'default' : 'pointer',
            minHeight: 44,
          }}
        >
          {generating ? t('generating') : active ? t('regenerateEpk') : t('generateEpk')}
        </button>
      </header>

      {loading && <div style={{ color: colors.text.muted }}>{t('loadingPressKitWorkspace')}</div>}
      {error && <div style={{ color: colors.danger, marginBottom: space[6] }}>{error}</div>}

      {!loading && !active && (
        <section
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: radius.xl,
            padding: space[10],
            background: 'rgba(7,7,5,0.78)',
            textAlign: 'center',
          }}
        >
          <div style={{ color: colors.accent, marginBottom: space[4], display: 'flex' }}>
            <Icon name="epk" size={34} />
          </div>
          <h2 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize.xl }}>
            {t('noEpkGeneratedYet')}
          </h2>
          <p
            style={{
              margin: `${space[3]}px auto 0`,
              color: colors.text.muted,
              maxWidth: 560,
              lineHeight: 1.6,
            }}
          >
            {t('noEpkDescription')}
          </p>
        </section>
      )}

      {active && (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: space[8],
            alignItems: 'start',
          }}
        >
          <aside
            style={{
              border: `1px solid ${colors.accentMuted}`,
              borderRadius: radius.xl,
              background: 'rgba(7,7,5,0.82)',
              padding: space[7],
            }}
          >
            <h2 style={{ margin: 0, color: colors.text.primary, fontSize: fontSize.lg }}>
              {active.title}
            </h2>
            <p
              style={{
                margin: `${space[3]}px 0 0`,
                color: colors.text.muted,
                fontSize: fontSize.sm,
              }}
            >
              {t('versionPublic', {
                v: active.version,
                visibility: active.is_public ? t('public') : t('private'),
                views: active.view_count,
              })}
            </p>
            <p
              style={{ margin: `${space[2]}px 0 0`, color: colors.text.dim, fontSize: fontSize.xs }}
            >
              {t('savedVersions', { count: kits.length })}
            </p>
            <div style={{ display: 'grid', gap: space[4], marginTop: space[7] }}>
              <Link to={`/epk/${active.public_slug}`} style={linkButtonStyle('primary')}>
                {t('openPublicEpk')}
              </Link>
              <Link to="/opportunities" style={linkButtonStyle('secondary')}>
                {t('useWithOpportunities')}
              </Link>
              <Link to="/agents/inbox" style={linkButtonStyle('ghost')}>
                {t('reviewAgentInbox')}
              </Link>
            </div>
            <p
              style={{
                margin: `${space[7]}px 0 0`,
                color: colors.text.faint,
                fontSize: fontSize.xs,
                lineHeight: 1.6,
              }}
            >
              Claude handoff: polish this studio with editable EPK sections, export controls, and
              mobile visual refinement. Codex owns the storage/API contract.
            </p>
          </aside>

          <PressKitPreview
            kit={active}
            fallbackName={profile?.display_name || profile?.username || 'MIXHIVE creator'}
          />
        </section>
      )}
    </div>
  );
}

function PressKitPreview({ kit, fallbackName }: { kit: PressKit; fallbackName: string }) {
  const t = useTranslations('pressKitStudio');
  const content = kit.content;
  return (
    <article
      style={{
        border: `1px solid ${colors.accentMuted}`,
        borderRadius: radius.xl,
        overflow: 'hidden',
        background: 'rgba(7,7,5,0.9)',
      }}
    >
      <div
        style={{
          padding: space[8],
          background: 'linear-gradient(135deg, rgba(240,192,64,0.18), rgba(7,7,5,0.2))',
        }}
      >
        <div style={{ display: 'flex', gap: space[6], alignItems: 'center' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              flexShrink: 0,
              background: content.avatar_url
                ? `url(${content.avatar_url}) center/cover`
                : colors.surface,
              border: `1px solid ${colors.accent}`,
            }}
          />
          <div>
            <h2
              style={{
                margin: 0,
                color: colors.text.primary,
                fontSize: fontSize['2xl'],
                lineHeight: 1.1,
              }}
            >
              {content.artist_name || fallbackName}
            </h2>
            <p style={{ margin: `${space[2]}px 0 0`, color: colors.text.muted }}>
              {[content.location, content.genres.slice(0, 4).join(' / ')]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
      </div>
      <div style={{ padding: space[8], display: 'grid', gap: space[7] }}>
        <section>
          <h3 style={sectionTitleStyle}>{t('bookingPitch')}</h3>
          <p style={bodyStyle}>
            {content.booking_pitch ||
              t('addMoreProfileDetails')}
          </p>
        </section>
        {content.bio && (
          <section>
            <h3 style={sectionTitleStyle}>{t('bio')}</h3>
            <p style={bodyStyle}>{content.bio}</p>
          </section>
        )}
        <section>
          <h3 style={sectionTitleStyle}>{t('featuredMixes')}</h3>
          {content.top_mixes.length === 0 ? (
            <p style={bodyStyle}>{t('noPublishedMixesYet')}</p>
          ) : (
            <div style={{ display: 'grid', gap: space[3] }}>
              {content.top_mixes.map(mix => (
                <Link
                  key={mix.id}
                  to={mix.url_path}
                  style={{
                    color: colors.text.secondary,
                    textDecoration: 'none',
                    border: `1px solid ${colors.border}`,
                    borderRadius: radius.md,
                    padding: space[4],
                  }}
                >
                  <strong style={{ color: colors.text.primary }}>{mix.title}</strong>
                  <span
                    style={{ color: colors.text.dim, fontSize: fontSize.xs, marginLeft: space[3] }}
                  >
                    {mix.play_count} {t('plays')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        {content.technical_notes.length > 0 && (
          <section>
            <h3 style={sectionTitleStyle}>{t('technicalNotes')}</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: colors.text.muted, lineHeight: 1.7 }}>
              {content.technical_notes.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}

const sectionTitleStyle: CSSProperties = {
  margin: `0 0 ${space[3]}px`,
  color: colors.accent,
  fontSize: fontSize.xs,
  fontWeight: fontWeight.bold,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
};

const bodyStyle: CSSProperties = {
  margin: 0,
  color: colors.text.muted,
  fontSize: fontSize.base,
  lineHeight: 1.7,
};

function linkButtonStyle(variant: 'primary' | 'secondary' | 'ghost'): CSSProperties {
  return {
    display: 'block',
    textAlign: 'center',
    textDecoration: 'none',
    border: `1px solid ${variant === 'primary' ? colors.accent : colors.border}`,
    borderRadius: radius.md,
    background:
      variant === 'primary'
        ? colors.accent
        : variant === 'secondary'
          ? colors.accentFaint
          : 'transparent',
    color:
      variant === 'primary'
        ? colors.bg
        : variant === 'secondary'
          ? colors.accent
          : colors.text.muted,
    padding: `${space[3]}px ${space[5]}px`,
    fontWeight: fontWeight.bold,
  };
}
