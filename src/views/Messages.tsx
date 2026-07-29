import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslations } from 'next-intl';
import { useAuth } from '../hooks/useAuth';
import { useMessages } from '../lib/messagesStore';
import { searchProfiles, getOrCreateDm } from '../lib/api';
import type { Profile } from '../lib/types';
import { colors, layout, space, fontSize, fontWeight, radius, transition, withAlpha } from '../styles/tokens';
import { SectionHeading } from '../components/ui/SectionHeading';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';

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

function NewConversationDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('messages');
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const profiles = await searchProfiles(query.trim());
      setResults(profiles);
      setSearching(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  async function handleSelect(profile: Profile) {
    setCreating(profile.id);
    const conversationId = await getOrCreateDm(profile.id);
    setCreating(null);
    if (conversationId) {
      onClose();
      navigate(`/messages/${conversationId}`);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 80,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Close"
        onClick={onClose}
        onKeyDown={e => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); }}
        style={{
          position: 'absolute',
          inset: 0,
          background: withAlpha(colors.black, 0.6),
        }}
      />
      <div
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: 480,
          background: colors.bg,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.xl,
          padding: space[6],
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: space[5],
          }}
        >
          <span style={{ fontWeight: fontWeight.semibold, color: colors.text.primary }}>
            {t('newConversation')}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.text.muted,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('searchUsers')}
          style={{
            width: '100%',
            padding: `${space[3]}px ${space[4]}px`,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.md,
            color: colors.text.primary,
            fontSize: fontSize.sm,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ marginTop: space[4], maxHeight: 320, overflowY: 'auto' }}>
          {searching && (
            <p style={{ fontSize: fontSize.sm, color: colors.text.dim, padding: space[3] }}>
              {t('searching')}...
            </p>
          )}
          {!searching && results.length === 0 && query.trim() && (
            <p style={{ fontSize: fontSize.sm, color: colors.text.dim, padding: space[3] }}>
              {t('noResults')}
            </p>
          )}
          {results.map(profile => (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile)}
              disabled={creating === profile.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[4],
                width: '100%',
                padding: `${space[3]}px ${space[4]}px`,
                background: 'transparent',
                border: 'none',
                borderRadius: radius.md,
                color: colors.text.primary,
                cursor: 'pointer',
                fontSize: fontSize.sm,
                textAlign: 'left',
                transition: transition.fast,
                opacity: creating === profile.id ? 0.6 : 1,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = colors.surfaceHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: profile.avatar_url
                    ? `url(${profile.avatar_url}) center/cover`
                    : colors.surfaceHover,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {!profile.avatar_url && (
                  <Icon name="profile" size={16} color={colors.text.muted} />
                )}
              </div>
              <div>
                <div style={{ fontWeight: fontWeight.medium }}>
                  {profile.display_name || profile.username}
                </div>
                {profile.username && (
                  <div style={{ fontSize: 11, color: colors.text.dim }}>@{profile.username}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MessagesPage() {
  const t = useTranslations('messages');
  const { user } = useAuth();
  const { conversations, refresh } = useMessages();
  const [composeOpen, setComposeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    refresh().catch(() => setError('Failed to load messages'));
  }, [refresh]);

  if (error) {
    return (
<div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto', padding: `${space[8]}px ${space[8]}px ${space[15]}px` }}>
        <SectionHeading eyebrow={t('chat')} title={t('messages')} />
        <div style={{ padding: space[10], textAlign: 'center', color: colors.danger, background: colors.dangerBg, borderRadius: radius.md, border: `1px solid ${colors.danger}` }}>
          <p>{error}</p>
          <Button variant="primary" size="md" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

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
    <div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto', padding: `${space[8]}px ${space[8]}px ${space[15]}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space[3] }}>
        <SectionHeading eyebrow={t('chat')} title={t('messages')} />
        <button
          onClick={() => setComposeOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[2],
            padding: '8px 14px',
            background: colors.accent,
            color: colors.black,
            border: 'none',
            borderRadius: radius.md,
            fontWeight: fontWeight.semibold,
            fontSize: fontSize.sm,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          {t('newMessage')}
        </button>
      </div>

      <NewConversationDialog open={composeOpen} onClose={() => setComposeOpen(false)} />

      {conversations.length === 0 ? (
        <p style={{ color: colors.text.dim, textAlign: 'center', padding: 40 }}>
          {t('noConversations')}
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
                      {conv.lastMessage.sender_id === user.id && <span>{t('you')} </span>}
                      {conv.lastMessage.body}
                    </>
                  ) : (
                    t('noMessagesYet')
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
