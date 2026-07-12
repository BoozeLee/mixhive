import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { followAIAgent, unfollowAIAgent, isFollowingAIAgent, type AIAgent } from '../lib/api';
import { colors, fontSize, fontWeight, radius, space, transition } from '../styles/tokens';

interface Props {
  agent: AIAgent;
  currentUserId?: string;
  onFollowToggle?: () => void;
}

export function AIAgentCard({ agent, currentUserId, onFollowToggle }: Props) {
  const t = useTranslations('aiBand');
  const navigate = useNavigate();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localFollowers, setLocalFollowers] = useState(agent.followers_count);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    isFollowingAIAgent(currentUserId, agent.id).then(v => {
      if (!cancelled) setFollowing(v);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId, agent.id]);

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) {
      navigate('/login?next=/ai-band');
      return;
    }
    if (busy) return;
    setBusy(true);
    const prev = following;
    setFollowing(!prev);
    setLocalFollowers(n => n + (prev ? -1 : 1));
    try {
      if (prev) await unfollowAIAgent(currentUserId, agent.id);
      else await followAIAgent(currentUserId, agent.id);
      onFollowToggle?.();
    } catch {
      setFollowing(prev);
      setLocalFollowers(n => n + (prev ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  const genres = (agent.genres ?? []).slice(0, 3);

  return (
    <Link
      to={`/ai-band/${agent.slug}`}
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          padding: space[6],
          display: 'flex',
          flexDirection: 'column',
          gap: space[4],
          transition: `border-color ${transition.fast}`,
          cursor: 'pointer',
          height: '100%',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = colors.accentMuted)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
      >
        {/* Avatar + name row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: space[4] }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: radius.full,
              background: agent.avatar_url ? undefined : `${colors.accentMuted}44`,
              flexShrink: 0,
              overflow: 'hidden',
              border: `2px solid ${colors.accentMuted}`,
            }}
          >
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                width={56}
                height={56}
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
                  fontSize: 22,
                  color: colors.accentMuted,
                }}
              >
                🤖
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: fontSize.md,
                fontWeight: fontWeight.semibold,
                color: colors.text.primary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {agent.name}
            </div>
            <div style={{ fontSize: fontSize.sm, color: colors.text.muted }}>@{agent.slug}</div>
          </div>
        </div>

        {/* Bio */}
        {agent.bio && (
          <div
            style={{
              fontSize: fontSize.sm,
              color: colors.text.secondary,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {agent.bio}
          </div>
        )}

        {/* Genre tags */}
        {genres.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {genres.map(g => (
              <span
                key={g}
                style={{
                  fontSize: 10,
                  fontWeight: fontWeight.semibold,
                  padding: '2px 7px',
                  borderRadius: radius.pill,
                  background: `${colors.accentMuted}22`,
                  border: `1px solid ${colors.accentMuted}44`,
                  color: colors.accentMuted,
                  whiteSpace: 'nowrap',
                }}
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Stats + follow row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[3],
            marginTop: 'auto',
          }}
        >
          <div style={{ display: 'flex', gap: space[4] }}>
            <span style={{ fontSize: fontSize.sm, color: colors.text.dim }}>
              <span style={{ fontWeight: fontWeight.semibold, color: colors.text.secondary }}>
                {localFollowers}
              </span>{' '}
              {t('followers')}
            </span>
            {agent.mixes_credited > 0 && (
              <span style={{ fontSize: fontSize.sm, color: colors.text.dim }}>
                <span style={{ fontWeight: fontWeight.semibold, color: colors.text.secondary }}>
                  {agent.mixes_credited}
                </span>{' '}
                {t('mixes')}
              </span>
            )}
          </div>
          <Button
            type="button"
            variant={following ? 'secondary' : 'primary'}
            size="sm"
            onClick={handleFollow}
            loading={busy}
          >
            {following ? t('following') : t('follow')}
          </Button>
        </div>
      </div>
    </Link>
  );
}
