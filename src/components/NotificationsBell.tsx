import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export function NotificationsBell() {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  const fetchUnread = useCallback(async () => {
    if (!user) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
    setUnread(count || 0)
  }, [user])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void fetchUnread()
        },
      )
      .subscribe()

    void fetchUnread()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchUnread])

  if (!user) return null

  return (
    <Link to="/notifications" style={{ position: 'relative', color: '#888', textDecoration: 'none', fontSize: 18, lineHeight: 1 }}>
      🔔
      {unread > 0 && (
        <span style={{
          position: 'absolute',
          top: -6,
          right: -8,
          background: '#f0c040',
          color: '#0a0a0a',
          fontSize: 10,
          fontWeight: 700,
          width: 16,
          height: 16,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
        }}>
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
