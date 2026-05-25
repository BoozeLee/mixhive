import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface FollowButtonProps {
  targetUserId: string
  currentUserId: string
  onToggle?: () => void
}

export function FollowButton({ targetUserId, currentUserId, onToggle }: FollowButtonProps) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (targetUserId === currentUserId) return
    supabase
      .from('follows')
      .select('*')
      .eq('follower_id', currentUserId)
      .eq('following_id', targetUserId)
      .maybeSingle()
      .then(({ data }) => setFollowing(!!data))
  }, [targetUserId, currentUserId])

  async function toggle() {
    if (loading || targetUserId === currentUserId) return
    setLoading(true)
    if (following) {
      await supabase.from('follows').delete().match({
        follower_id: currentUserId,
        following_id: targetUserId
      })
      setFollowing(false)
    } else {
      await supabase.from('follows').insert({
        follower_id: currentUserId,
        following_id: targetUserId
      })
      setFollowing(true)
    }
    setLoading(false)
    onToggle?.()
  }

  if (targetUserId === currentUserId) return null

  return (
    <button
      onClick={toggle}
      disabled={loading}
      style={{
        background: following ? '#1a1a2e' : '#f0c040',
        color: following ? '#888' : '#0a0a0a',
        border: following ? '1px solid #333' : 'none',
        padding: '6px 14px',
        borderRadius: 6,
        cursor: loading ? 'wait' : 'pointer',
        fontSize: 12,
        fontWeight: following ? 400 : 600,
      }}
    >
      {loading ? '...' : following ? 'Following' : '+ Follow'}
    </button>
  )
}
