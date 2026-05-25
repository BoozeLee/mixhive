import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getNotifications, markNotificationsRead } from '../lib/api'
import type { Notification } from '../lib/types'

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getNotifications(user.id).then(data => {
      setNotifications(data)
      markNotificationsRead(user.id)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user])

  function notificationText(n: Notification) {
    const actor = n.actor?.display_name || n.actor?.username || 'Someone'
    switch (n.type) {
      case 'like': return `${actor} liked your mix`
      case 'follow': return `${actor} followed you`
      case 'comment': return `${actor} commented on your mix`
      case 'reply': return `${actor} replied to your comment`
      case 'mix_upload': return `${actor} uploaded a new mix`
      default: return `${actor} interacted with you`
    }
  }

  function notificationLink(n: Notification): string {
    switch (n.type) {
      case 'follow': return `/u/${n.actor?.username || ''}`
      case 'like':
      case 'comment':
      case 'reply':
      case 'mix_upload': return n.mix_id ? `/mix/${n.mix_id}` : '#'
      default: return '#'
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eee', marginBottom: 20 }}>Notifications</h1>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: '1px solid #111' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#111', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, background: '#111', borderRadius: 4, width: '60%', marginBottom: 6 }} />
              <div style={{ height: 12, background: '#0d0d0d', borderRadius: 4, width: '30%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#666' }}>
        <p style={{ marginBottom: 12 }}>Sign in to see your notifications</p>
        <Link to="/login" style={{ color: '#f0c040' }}>Sign in</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#eee', marginBottom: 20 }}>Notifications</h1>
      {notifications.length === 0 ? (
        <p style={{ color: '#555', fontSize: 14, textAlign: 'center', padding: 40 }}>
          No notifications yet. Follow some DJs and come back!
        </p>
      ) : (
        <div>
          {notifications.map(n => (
            <Link
              key={n.id}
              to={notificationLink(n)}
              style={{
                display: 'flex',
                gap: 12,
                padding: '14px 0',
                borderBottom: '1px solid #111',
                textDecoration: 'none',
                color: 'inherit',
                opacity: n.read ? 0.6 : 1,
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: n.actor?.avatar_url
                  ? `url(${n.actor.avatar_url}) center/cover`
                  : '#1a1a2e',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: '#f0c04044',
              }}>
                {!n.actor?.avatar_url && '🎧'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, color: '#ccc', margin: 0, lineHeight: 1.4 }}>
                  {notificationText(n)}
                </p>
                <p style={{ fontSize: 12, color: '#555', margin: '4px 0 0' }}>
                  {new Date(n.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
