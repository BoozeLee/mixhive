import { Link } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../lib/messagesStore';
import { colors, space, fontSize, fontWeight, radius } from '../styles/tokens';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Icon } from '../components/ui/Icon';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export function MessagesPage() {
  const t = useTranslations('messages');
  const { user } = useAuth();
  const { conversations } = useMessages();

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: colors.text.dim }}>
        <p style={{ marginBottom: space[6] }}>{t('signInToSee')}</p>
        <Link to="/login" style={{ color: colors.accent }}>
          {t('signIn')}
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 16px 96px' }}>
      <SectionHeading eyebrow={t('chat')} title={t('messages')} />

      {conversations.length === 0 ? (
        <p style={{ color: colors.text.dim, textAlign: 'center', padding: 40 }}>
          No messages yet. Start a conversation from a profile page.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: space[3], marginTop: space[8] }}>
          {conversations.map(conv => (
            <Link
              key={conv.conversation.id}
              to={`/messages/${conv.conversation.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[5],
                padding: '14px 16px',
                borderRadius: radius.lg,
                border: `1px solid ${conv.unread ? colors.accentMuted : colors.border}`,
                background: conv.unread ? 'rgba(246,196,0,0.04)' : 'transparent',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color 0.15s, background 0.15s',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: conv.otherMember.avatar_url
                    ? `url(${conv.otherMember.avatar_url}) center/cover`
                    : colors.surfaceHover,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!conv.otherMember.avatar_url && (
                  <Icon name="profile" size={20} color={colors.text.muted} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: space[3] }}>
                  <span style={{ fontWeight: fontWeight.semibold, color: colors.text.primary }}>
                    {conv.otherMember.display_name || conv.otherMember.username}
                  </span>
                  <span
                    style={{ fontSize: fontSize.sm, color: colors.text.dim, marginLeft: 'auto' }}
                  >
                    {conv.lastMessage ? relativeTime(conv.lastMessage.created_at) : ''}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: fontSize.sm,
                    color: conv.unread ? colors.text.secondary : colors.text.dim,
                    margin: '4px 0 0',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: conv.unread ? fontWeight.medium : fontWeight.normal,
                  }}
                >
                  {conv.lastMessage ? (
                    <>
                      {conv.lastMessage.sender_id === user.id && <span>{t('you')}</span>}
                      {conv.lastMessage.body}
                    </>
                  ) : (
                    'No messages yet'
                  )}
                </p>
              </div>
              {conv.unread && (
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: colors.accent,
                    boxShadow: '0 0 8px rgba(246,196,0,0.6)',
                    flexShrink: 0,
                  }}
                />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
