import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getNotifications, markNotificationsRead } from '../lib/api'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { Notification } from '../lib/types'
import { colors, space } from '../styles/tokens'
import { Button } from '../components/ui/Button'

export function NotificationsPage() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await getNotifications(user.id)
      setNotifications(data)
      void markNotificationsRead(user.id)
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user || !isSupabaseConfigured) return

    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        void fetchNotifications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchNotifications])

  useEffect(() => {
    if (user) void fetchNotifications()
    else setLoading(false)
  }, [user, fetchNotifications])

  async function markAllAsRead() {
    if (!user) return
    await markNotificationsRead(user.id)
    setNotifications(prev => prev.map(notification => ({ ...notification, read: true })))
  }

  function notificationText(notification: Notification) {
    const actor = notification.actor?.display_name || notification.actor?.username || 'Someone'
    switch (notification.type) {
      case 'like': return `${actor} liked your mix`
      case 'follow': return `${actor} followed you`
      case 'comment': return `${actor} commented on your mix`
      case 'reply': return `${actor} replied to your comment`
      case 'mix_upload': return `${actor} uploaded a new mix`
      default: return `${actor} interacted with you`
    }
  }

  function notificationLink(notification: Notification): string {
    switch (notification.type) {
      case 'follow': return notification.actor?.username ? `/u/${notification.actor.username}` : '#'
      case 'like':
      case 'comment':
      case 'reply':
      case 'mix_upload': return notification.mix_id ? `/mix/${notification.mix_id}` : '#'
      default: return '#'
    }
  }

  const unreadCount = notifications.filter(notification => !notification.read).length

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text.primary, marginBottom: 20 }}>Notifications</h1>
        {[1, 2, 3].map(index => (
          <div key={index} style={{ display: 'flex', gap: space[6], padding: '14px 0', borderBottom: `1px solid ${colors.border}` }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: colors.surface, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 14, background: colors.surface, borderRadius: 4, width: '60%', marginBottom: space[3] }} />
              <div style={{ height: 12, background: colors.surfaceMuted, borderRadius: 4, width: '30%' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: colors.text.dim }}>
        <p style={{ marginBottom: space[6] }}>Sign in to see your notifications</p>
        <Link to="/login" style={{ color: colors.accent }}>Sign in</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[8], marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text.primary, margin: 0 }}>
          Notifications
        </h1>
        <Button size="sm" variant="ghost" onClick={markAllAsRead} disabled={unreadCount === 0}>
          Mark all read
        </Button>
      </div>

      {notifications.length === 0 ? (
        <p style={{ color: colors.text.dim, fontSize: 14, textAlign: 'center', padding: 40 }}>
          No notifications yet. Follow some DJs and come back.
        </p>
      ) : (
        <div>
          {notifications.map(notification => (
            <Link
              key={notification.id}
              to={notificationLink(notification)}
              style={{
                display: 'flex',
                gap: space[6],
                padding: '14px 0',
                borderBottom: `1px solid ${colors.border}`,
                textDecoration: 'none',
                color: 'inherit',
                opacity: notification.read ? 0.6 : 1,
              }}
            >
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: notification.actor?.avatar_url
                  ? `url(${notification.actor.avatar_url}) center/cover`
                  : colors.surfaceHover,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                color: colors.accentMuted,
              }}>
                {!notification.actor?.avatar_url && '♪'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, color: colors.text.secondary, margin: 0, lineHeight: 1.4 }}>
                  {notificationText(notification)}
                </p>
                <p style={{ fontSize: 12, color: colors.text.dim, margin: '4px 0 0' }}>
                  {new Date(notification.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              {!notification.read && (
                <span aria-label="Unread" style={{ width: 8, height: 8, borderRadius: '50%', background: colors.accent, alignSelf: 'center' }} />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
