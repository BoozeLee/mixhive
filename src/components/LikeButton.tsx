import { useEffect, useState } from 'react';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { hasLiked, like, unlike } from '../lib/api';
import type { Mix } from '../lib/types';
import { colors } from '../styles/tokens';

interface LikeButtonProps {
  mix: Mix;
  userId?: string;
  variant?: 'icon' | 'button';
  showCount?: boolean;
  onLike?: (isLiked: boolean) => void;
  className?: string;
}

export function LikeButton({
  mix,
  userId,
  variant = 'icon',
  showCount = true,
  onLike,
  className,
}: LikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(mix.like_count || 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !mix.id) return;
    hasLiked(userId, mix.id).then(liked => {
      if (!cancelled) setIsLiked(liked);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, mix.id]);

  async function handleLike() {
    if (!userId || !mix.id || loading) return;
    setLoading(true);
    try {
      if (isLiked) {
        await unlike(userId, mix.id);
        setIsLiked(false);
        setLikeCount(prev => Math.max(prev - 1, 0));
        onLike?.(false);
      } else {
        await like(userId, mix.id);
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
        onLike?.(true);
      }
    } finally {
      setLoading(false);
    }
  }

  if (variant === 'icon') {
    return (
      <IconButton
        label={isLiked ? 'Unlike' : 'Like'}
        onClick={handleLike}
        disabled={!userId || loading}
        className={className}
        active={isLiked}
        style={{
          color: isLiked ? colors.danger : colors.text.muted,
          borderColor: isLiked ? colors.danger : colors.border,
        }}
      >
        {isLiked ? '♥' : '♡'}
      </IconButton>
    );
  }

  return (
    <Button
      type="button"
      variant={isLiked ? 'danger' : 'secondary'}
      onClick={handleLike}
      loading={loading}
      disabled={!userId}
      className={className}
      leftIcon={<span aria-hidden="true">{isLiked ? '♥' : '♡'}</span>}
    >
      {showCount ? likeCount : isLiked ? 'Liked' : 'Like'}
    </Button>
  );
}

export function useLike(mix: Mix, userId?: string) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(mix.like_count || 0);
  const [loading, setLoading] = useState(false);

  async function refetch() {
    if (!userId || !mix.id) return;
    setIsLiked(await hasLiked(userId, mix.id));
  }

  async function toggleLike() {
    if (!userId || !mix.id || loading) return;
    setLoading(true);
    try {
      if (isLiked) {
        await unlike(userId, mix.id);
        setIsLiked(false);
        setLikeCount(prev => Math.max(prev - 1, 0));
      } else {
        await like(userId, mix.id);
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
      }
    } finally {
      setLoading(false);
    }
  }

  return { isLiked, likeCount, loading, toggleLike, refetch };
}
