import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './ui/Button';
import { useAuth } from '../hooks/useAuth';
import { followAgent, isFollowingAgent, unfollowAgent } from '../lib/api';

interface Props {
  slug: string;
  onChange?: (delta: number) => void;
}

// Follow / unfollow an AI agent-artist. Optimistic, sign-in gated.
export function AgentFollowButton({ slug, onChange }: Props) {
  const t = useTranslations('aiBand');
  const { user } = useAuth();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  // Don't let a slow initial fetch clobber a click the user already made.
  const interacted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    interacted.current = false;
    if (!user || !slug) return;
    isFollowingAgent(slug, user.id).then(v => {
      if (!cancelled && !interacted.current) setFollowing(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user, slug]);

  async function toggle() {
    if (!user || loading) return;
    interacted.current = true;
    setLoading(true);
    const prev = following;
    setFollowing(!prev);
    onChange?.(prev ? -1 : 1);
    try {
      const { error } = prev
        ? await unfollowAgent(slug, user.id)
        : await followAgent(slug, user.id);
      if (error) {
        setFollowing(prev);
        onChange?.(prev ? 1 : -1);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant={following ? 'secondary' : 'primary'}
      size="sm"
      onClick={toggle}
      loading={loading}
      disabled={!user}
    >
      {following ? t('following') : t('follow')}
    </Button>
  );
}
