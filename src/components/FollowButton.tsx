import { useEffect, useState } from 'react'
import { Button } from './ui/Button'
import { follow, isFollowing as readIsFollowing, unfollow } from '../lib/api'
import type { Profile } from '../lib/types'

type Props = {
  profile?: Profile
  targetUserId?: string
  currentUserId?: string
  userId?: string
  showCount?: boolean
  onFollow?: (isFollowing: boolean) => void
  onToggle?: () => void
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
}

export function FollowButton({
  profile,
  targetUserId,
  currentUserId,
  userId,
  onFollow,
  onToggle,
  className,
  variant = 'default',
}: Props) {
  const targetId = targetUserId || profile?.id
  const viewerId = currentUserId || userId
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!viewerId || !targetId || viewerId === targetId) return
    readIsFollowing(viewerId, targetId).then(value => {
      if (!cancelled) setIsFollowing(value)
    })
    return () => {
      cancelled = true
    }
  }, [viewerId, targetId])

  async function toggle() {
    if (!viewerId || !targetId || viewerId === targetId || loading) return
    setLoading(true)
    try {
      if (isFollowing) {
        await unfollow(viewerId, targetId)
        setIsFollowing(false)
        onFollow?.(false)
      } else {
        await follow(viewerId, targetId)
        setIsFollowing(true)
        onFollow?.(true)
      }
      onToggle?.()
    } finally {
      setLoading(false)
    }
  }

  if (!targetId || viewerId === targetId) return null

  return (
    <Button
      type="button"
      variant={isFollowing ? (variant === 'ghost' ? 'ghost' : 'secondary') : 'primary'}
      size="sm"
      onClick={toggle}
      loading={loading}
      disabled={!viewerId}
      className={className}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </Button>
  )
}
