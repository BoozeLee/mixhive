import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../lib/notificationStore';
import { colors, radius, space, fontSize } from '../styles/tokens';
import { EmptyState } from '../components/EmptyState';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
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
  const t = useTranslations('notifications');
  const tn = useTranslations('nav');
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, refresh } = useNotifications();
  const [loading, setLoading] = useState(!user); // Loading when no user
  const [error, setError] = useState<string | null>(null);

  // Fetch initial notifications when user changes
  useEffect(() => {
    if (user) {
      setError(null);
      refresh().catch(() => setError('Failed to load notifications'));
    } else {
      setLoading(false);
    }
  }, [user, refresh]);

  if (error) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
        <SectionHeading as="h1" eyebrow={t('eyebrow')} title={t('title')} />
        <div
          style={{
            padding: space[10],
            textAlign: 'center',
            color: colors.danger,
            background: colors.dangerBg,
            borderRadius: radius.md,
            border: `1px solid ${colors.danger}`,
          }}
        >
          <p>{error}</p>
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  async function handleMarkAllAsRead() {
    if (!user) return;
    await markAllAsRead();
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px' }}>
        <SectionHeading as="h1" eyebrow={t('eyebrow')} title={t('title')} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: space[12] }}>
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: colors.text.dim }}>
        <p style={{ marginBottom: space[6] }}>{t('signInPrompt')}</p>
        <Link to="/login" style={{ color: colors.accent }}>
          {tn('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: space[8],
          marginBottom: space[10],
        }}
      >
        <h1 style={{ fontSize: 20, fontWeight: 700, color: colors.text.primary, margin: 0 }}>
          Notifications
        </h1>
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
        <EmptyState
          iconKey="notifications"
          title="No notifications yet"
          body="Follow some DJs and come back — the hive will keep you posted."
          actionLabel="Explore DJs"
          actionTo="/discover"
        />
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
                  borderRadius: 10,
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
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <p
                    style={{
                      fontSize: fontSize.md,
                      color: colors.text.secondary,
                      margin: 0,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
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
                    aria-label={t('unread')}
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
