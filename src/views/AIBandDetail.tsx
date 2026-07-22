import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import {
  getAIAgent,
  getAIAgentMixes,
  followAIAgent,
  unfollowAIAgent,
  isFollowingAIAgent,
} from '../lib/api';
import type { AIAgent, AIAgentMix } from '../lib/api';
import { MixCard } from '../components/MixCard';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import type { FeedMix } from '../lib/types';
import { colors, fontSize, fontWeight, radius, space } from '../styles/tokens';

function mixFromCredit(credit: AIAgentMix): FeedMix | null {
  const m = credit.mixes;
  if (!m) return null;
  const p = m.profiles;
  return {
    id: m.id,
    title: m.title,
    artwork_url: m.artwork_url,
    audio_url: m.audio_url ?? '',
    play_count: m.play_count ?? 0,
    like_count: m.like_count ?? 0,
    duration_seconds: m.duration_seconds ?? null,
    created_at: m.created_at,
    dj_id: '',
    dj_username: p?.username ?? '',
    dj_display_name: p?.display_name ?? null,
    dj_avatar_url: p?.avatar_url ?? null,
    genre_name: null,
    audio_quality: null,
    is_repost: false,
    reposted_by_username: null,
  } as FeedMix;
}

export function AIBandDetail() {
  const t = useTranslations('aiBand');
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AIAgent | null>(null);
  const [mixes, setMixes] = useState<AIAgentMix[]>([]);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [localFollowers, setLocalFollowers] = useState(0);

  useEffect(() => {
    if (!slug) return;
    Promise.all([getAIAgent(slug), user ? isFollowingAIAgent(user.id, '') : Promise.resolve(false)])
      .then(([a]) => {
        setAgent(a);
        setLocalFollowers(a?.followers_count ?? 0);
        if (a && user) {
          isFollowingAIAgent(user.id, a.id).then(setFollowing);
        }
        return a ? getAIAgentMixes(a.id) : [];
      })
      .then(setMixes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug, user]);

  async function handleFollow() {
    if (!user || !agent) {
      navigate('/login?next=/ai-band/' + slug);
      return;
    }
    if (followBusy) return;
    setFollowBusy(true);
    const prev = following;
    setFollowing(!prev);
    setLocalFollowers(n => n + (prev ? -1 : 1));
    try {
      if (prev) await unfollowAIAgent(user.id, agent.id);
      else await followAIAgent(user.id, agent.id);
    } catch {
      setFollowing(prev);
      setLocalFollowers(n => n + (prev ? 1 : -1));
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: '0 16px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
        <h1 style={{ fontSize: fontSize.xl, color: colors.text.primary, marginBottom: 8 }}>
          {t('notFoundTitle')}
        </h1>
        <p style={{ color: colors.text.muted, marginBottom: 24 }}>{t('notFoundBody')}</p>
        <Link to="/ai-band">
          <Button variant="secondary" size="sm">
            {t('backToBand')}
          </Button>
        </Link>
      </div>
    );
  }

  const genres = agent.genres ?? [];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Agent header */}
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          padding: space[8],
          marginBottom: space[8],
          display: 'flex',
          gap: space[6],
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: radius.full,
            background: agent.avatar_url ? undefined : `${colors.accentMuted}44`,
            flexShrink: 0,
            overflow: 'hidden',
            border: `3px solid ${colors.accentMuted}`,
          }}
        >
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt={agent.name}
              width={96}
              height={96}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 40,
              }}
            >
              🤖
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ display: 'flex', alignItems: 'flex-start', gap: space[4], flexWrap: 'wrap' }}
          >
            <div style={{ flex: 1 }}>
              <h1
                style={{
                  fontSize: fontSize['2xl'],
                  fontWeight: fontWeight.bold,
                  color: colors.text.primary,
                  margin: 0,
                }}
              >
                {agent.name}
              </h1>
              <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginTop: 2 }}>
                @{agent.slug}
              </div>
            </div>
            <Button
              type="button"
              variant={following ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleFollow}
              loading={followBusy}
            >
              {following ? t('following') : t('follow')}
            </Button>
          </div>

          {agent.bio && (
            <p
              style={{
                fontSize: fontSize.md,
                color: colors.text.secondary,
                marginTop: space[4],
                marginBottom: 0,
              }}
            >
              {agent.bio}
            </p>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: space[6], marginTop: space[5], flexWrap: 'wrap' }}>
            <div>
              <span style={{ fontWeight: fontWeight.semibold, color: colors.text.primary }}>
                {localFollowers}
              </span>
              <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                {' '}
                {t('followers')}
              </span>
            </div>
            <div>
              <span style={{ fontWeight: fontWeight.semibold, color: colors.text.primary }}>
                {agent.mixes_credited}
              </span>
              <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}> {t('mixes')}</span>
            </div>
            <div>
              <span style={{ fontWeight: fontWeight.semibold, color: colors.text.primary }}>
                {t('levelShort', { level: agent.level })}
              </span>
              <span style={{ fontSize: fontSize.sm, color: colors.text.muted }}>
                {' '}
                · {t('xp', { xp: agent.xp })}
              </span>
            </div>
          </div>

          {/* Genre tags */}
          {genres.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: space[4] }}>
              {genres.map(g => (
                <span
                  key={g}
                  style={{
                    fontSize: 11,
                    fontWeight: fontWeight.semibold,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: `${colors.accentMuted}22`,
                    border: `1px solid ${colors.accentMuted}44`,
                    color: colors.accentMuted,
                  }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Credited mixes */}
      <h2
        style={{
          fontSize: fontSize.lg,
          fontWeight: fontWeight.semibold,
          color: colors.text.primary,
          marginBottom: space[5],
        }}
      >
        {t('creditedOn')}
      </h2>

      {mixes.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: colors.text.muted,
            fontSize: fontSize.md,
          }}
        >
          {t('noCreditedMixes')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
          {mixes.map(credit => {
            const mix = mixFromCredit(credit);
            if (!mix) return null;
            return (
              <div key={credit.mix_id}>
                {credit.credit_label && (
                  <div
                    style={{
                      fontSize: 11,
                      color: colors.text.dim,
                      padding: '0 0 4px 4px',
                      fontStyle: 'italic',
                    }}
                  >
                    {credit.credit_label}
                  </div>
                )}
                <MixCard mix={mix} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
