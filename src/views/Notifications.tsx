import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../lib/notificationStore';
import { colors, space, fontSize } from '../styles/tokens';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Reveal } from '../components/ui/Reveal';
import type { IconKey } from '../lib/icons';
import { notificationPresentation } from '../lib/notificationPresentation';

const TYPE_ICON: Record<string, IconKey> = {
  like: 'like',
  follow: 'profile',
  comment: 'comment',
  reply: 'comment',
  mix_upload: 'mix',
  mention: 'mention',
  buzz_like: 'like',
  repost: 'repost',
  verification: 'verified',
  message: 'messages',
};

export function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();
  const [loading, setLoading] = useState(!user); // Loading when no user

  // Fetch initial notifications when user changes
  useEffect(() => {
    if (user) {
      void refresh();
    } else {
      setLoading(false);
    }
  }, [user, refresh]);

  async function handleMarkAllAsRead() {
    if (!user) return;
    await markAllAsRead();
  }

  if (loading) {
    return (
      <div id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
        <SectionHeading eyebrow="Activity" title="Notifications" />
        <p style={{ color: colors.text.dim, marginTop: space[8] }}>Loading notifications…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div id="main-content" style={{ textAlign: 'center', padding: 60, color: colors.text.dim }}>
        <p style={{ marginBottom: space[6] }}>Sign in to see your notifications</p>
        <Link to="/login" style={{ color: colors.accent }}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: space[8],
          marginBottom: space[10],
        }}
      >
        <SectionHeading eyebrow="Activity" title="Notifications" />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleMarkAllAsRead}
          disabled={unreadCount === 0}
        >
          Mark all read
        </Button>
      </div>

      {notifications.length === 0 ? (
        <p style={{ color: colors.text.dim, fontSize: 14, textAlign: 'center', padding: 40 }}>
          No notifications yet. Follow some DJs and come back.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: space[3] }}>
          {notifications.map((notification, i) => (
            <Reveal key={notification.id} index={i} from="up">
              <Link
                to={notificationPresentation(notification).url}
                onClick={() => {
                  if (!notification.read) void markAsRead([notification.id]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[6],
                  padding: '14px 16px',
                  borderRadius: 12,
                  border: `1px solid ${notification.read ? colors.border : colors.accentMuted}`,
                  background: notification.read ? 'transparent' : 'rgba(246,196,0,0.04)',
                  textDecoration: 'none',
                  color: 'inherit',
                  opacity: notification.read ? 0.7 : 1,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = colors.accent;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = notification.read
                    ? colors.border
                    : colors.accentMuted;
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: notification.actor?.avatar_url
                      ? `url(${notification.actor.avatar_url}) center/cover`
                      : colors.surfaceHover,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.accent,
                  }}
                >
                  {!notification.actor?.avatar_url && (
                    <Icon
                      name={TYPE_ICON[notification.type] ?? 'notifications'}
                      size={18}
                      color="currentColor"
                    />
                  )}
                  {/* type badge on the corner */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      bottom: -2,
                      right: -2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: colors.bg,
                      border: `1px solid ${colors.accentMuted}`,
                      display: 'grid',
                      placeItems: 'center',
                      color: colors.accent,
                    }}
                  >
                    <Icon
                      name={TYPE_ICON[notification.type] ?? 'notifications'}
                      size={10}
                      color="currentColor"
                    />
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: fontSize.md,
                      color: colors.text.secondary,
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {notificationPresentation(notification).body}
                  </p>
                  <p style={{ fontSize: fontSize.sm, color: colors.text.dim, margin: '4px 0 0' }}>
                    {new Date(notification.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                {!notification.read && (
                  <span
                    aria-label="Unread"
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: colors.accent,
                      boxShadow: '0 0 8px rgba(246,196,0,0.6)',
                      alignSelf: 'center',
                      flexShrink: 0,
                    }}
                  />
                )}
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
