import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getBuzz, getBuzzReplies, replyToBuzz } from '../lib/api';
import { BuzzCard } from '../components/BuzzCard';
import { ReportButton } from '../components/ReportButton';
import { SkeletonFeed } from '../components/Skeleton';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import { BuzzToast } from '../components/hive/BuzzToast';
import type { FeedBuzz } from '../lib/types';

const MAX_CHARS = 280;

export function BuzzDetail() {
  const t = useTranslations('buzzDetail');
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [buzz, setBuzz] = useState<FeedBuzz | null>(null);
  const [replies, setReplies] = useState<FeedBuzz[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: 'info' | 'success' | 'danger';
  }>({ open: false, message: '', tone: 'info' });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setFetchError(null);
    Promise.all([getBuzz(id), getBuzzReplies(id, 50)])
      .then(([b, r]) => {
        if (b) setBuzz(b as FeedBuzz);
        setReplies(r.data);
      })
      .catch(() => setFetchError('Could not load buzz'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleReply() {
    if (!user || !id || !replyBody.trim() || replyBusy) return;
    setReplyBusy(true);
    try {
      const newReply = await replyToBuzz(user.id, id, replyBody.trim());
      if (newReply) {
        const feed = { ...newReply, author: profile ?? undefined } as FeedBuzz;
        setReplies(r => [...r, feed]);
        setBuzz(b => (b ? { ...b, reply_count: b.reply_count + 1 } : b));
        setReplyBody('');
      }
    } catch {
      setToast({ open: true, message: t('couldNotPostReply'), tone: 'danger' });
    } finally {
      setReplyBusy(false);
    }
  }

  function handleReplyDeleted(replyId: string) {
    setReplies(r => r.filter(x => x.id !== replyId));
    setBuzz(b => (b ? { ...b, reply_count: Math.max(0, b.reply_count - 1) } : b));
  }

  const remaining = MAX_CHARS - replyBody.length;
  const canReply = replyBody.trim().length > 0 && remaining >= 0 && !replyBusy;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: colors.text.muted,
          cursor: 'pointer',
          fontSize: fontSize.base,
          marginBottom: space[8],
          display: 'flex',
          alignItems: 'center',
          gap: space[4],
        }}
      >
        {t('back')}
      </button>

      {loading ? (
        <SkeletonFeed />
      ) : fetchError ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.danger }}>
          {fetchError}
        </div>
      ) : !buzz ? (
        <div style={{ textAlign: 'center', padding: 40, color: colors.text.dim }}>
          {t('buzzNotFound')}
        </div>
      ) : (
        <>
          {/* Parent buzz */}
          <BuzzCard buzz={buzz} onDeleted={() => navigate(-1)} />
          {user && user.id !== buzz.author_id && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
              <ReportButton sourceTable="buzzes" sourceId={buzz.id} />
            </div>
          )}

          {/* Reply composer */}
          {user ? (
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.xl,
                padding: `${space[7]}px ${space[9]}px`,
                margin: `${space[7]}px 0`,
              }}
            >
              <div style={{ display: 'flex', gap: space[7] }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: colors.accentFaint,
                    border: `2px solid ${colors.border}`,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: fontWeight.bold,
                    color: colors.accent,
                    fontSize: fontSize.base,
                  }}
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="You"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (profile?.display_name || profile?.username || '?').charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value.slice(0, MAX_CHARS + 10))}
                    placeholder={t('replyToThisBuzz')}
                    rows={2}
                    aria-label={t('writeAReply')}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      resize: 'none',
                      color: colors.text.primary,
                      fontSize: fontSize.base,
                      lineHeight: 1.5,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: space[6],
                      marginTop: space[4],
                    }}
                  >
                    <span
                      style={{
                        fontSize: fontSize.sm,
                        color:
                          remaining < 60
                            ? remaining <= 0
                              ? colors.danger
                              : colors.warning
                            : colors.text.dim,
                      }}
                    >
                      {remaining < 60 ? remaining : ''}
                    </span>
                    <button
                      onClick={handleReply}
                      disabled={!canReply}
                      style={{
                        padding: `${space[3]}px ${space[8]}px`,
                        background: canReply ? colors.accent : colors.surfaceMuted,
                        color: canReply ? colors.bg : colors.text.faint,
                        border: 'none',
                        borderRadius: radius.pill,
                        fontWeight: fontWeight.bold,
                        fontSize: fontSize.sm,
                        cursor: canReply ? 'pointer' : 'default',
                      }}
                    >
                      {replyBusy ? '…' : t('reply')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: `${space[7]}px 0`,
                color: colors.text.dim,
                fontSize: fontSize.base,
              }}
            >
          <button
            onClick={() => navigate('/login')}
            style={{
              background: 'none',
              border: 'none',
              color: colors.accent,
              cursor: 'pointer',
              fontWeight: fontWeight.semibold,
              fontSize: fontSize.base,
            }}
          >
            {t('signIn')}
          </button>{' '}
          {t('toReply')}
            </div>
          )}

          {/* Replies */}
          {replies.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
              <p
                style={{
                  margin: `0 0 ${space[4]}px`,
                  fontSize: fontSize.sm,
                  color: colors.text.dim,
                  fontWeight: fontWeight.semibold,
                }}
              >
                {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </p>
              {replies.map(r => (
                <BuzzCard key={r.id} buzz={r} compact onDeleted={handleReplyDeleted} />
              ))}
            </div>
          )}
        </>
      )}

      <BuzzToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </div>
  );
}
