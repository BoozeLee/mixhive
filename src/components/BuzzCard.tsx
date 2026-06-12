import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Icon } from './ui/Icon';
import {
  likeBuzz,
  unlikeBuzz,
  hasBuzzLiked,
  repostBuzz,
  unrepostBuzz,
  hasBuzzReposted,
  deleteBuzz,
} from '../lib/api';
import { colors, radius, space, fontSize, fontWeight } from '../styles/tokens';
import type { FeedBuzz } from '../lib/types';
import { BuzzToast } from './hive/BuzzToast';

interface Props {
  buzz: FeedBuzz;
  compact?: boolean;
  onDeleted?: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(dateStr).toLocaleDateString();
}

const LANG_LABELS: Record<string, string> = {
  lua: 'Lua',
  javascript: 'JS',
  typescript: 'TS',
  python: 'Python',
  bash: 'Bash',
  sql: 'SQL',
  json: 'JSON',
  rust: 'Rust',
  go: 'Go',
};

export function BuzzCard({ buzz, compact = false, onDeleted }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [liked, setLiked] = useState<boolean | null>(null);
  const [likeCount, setLikeCount] = useState(buzz.like_count);
  const [reposted, setReposted] = useState<boolean | null>(null);
  const [repostCount, setRepostCount] = useState(buzz.repost_count);
  const [imgExpanded, setImgExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    tone: 'info' | 'success' | 'danger';
  }>({ open: false, message: '', tone: 'info' });
  const likeInitRef = useRef(false);
  const repostInitRef = useRef(false);

  // Lazy-load like/repost state on first hover so the list doesn't spam 40+ requests
  async function initLike() {
    if (likeInitRef.current || !user) return;
    likeInitRef.current = true;
    const v = await hasBuzzLiked(user.id, buzz.id);
    setLiked(v);
  }

  async function initRepost() {
    if (repostInitRef.current || !user) return;
    repostInitRef.current = true;
    const v = await hasBuzzReposted(user.id, buzz.id);
    setReposted(v);
  }

  async function handleLike(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    if (busy) return;
    const prev = liked ?? false;
    setLiked(!prev);
    setLikeCount(c => (prev ? Math.max(0, c - 1) : c + 1));
    setBusy(true);
    try {
      if (prev) await unlikeBuzz(user.id, buzz.id);
      else await likeBuzz(user.id, buzz.id);
    } catch {
      setLiked(prev);
      setLikeCount(c => (prev ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setBusy(false);
    }
  }

  async function handleRepost(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) {
      navigate('/login');
      return;
    }
    if (busy) return;
    const prev = reposted ?? false;
    setReposted(!prev);
    setRepostCount(c => (prev ? Math.max(0, c - 1) : c + 1));
    setBusy(true);
    try {
      if (prev) await unrepostBuzz(user.id, buzz.id);
      else await repostBuzz(user.id, buzz.id);
    } catch {
      setReposted(prev);
      setRepostCount(c => (prev ? c + 1 : Math.max(0, c - 1)));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!user || user.id !== buzz.author_id) return;
    if (!confirm('Delete this buzz?')) return;
    try {
      await deleteBuzz(buzz.id);
      onDeleted?.(buzz.id);
    } catch {
      setToast({ open: true, message: 'Could not delete buzz', tone: 'danger' });
    }
  }

  function handleShare(e: React.MouseEvent) {
    e.stopPropagation();
    const url = `${window.location.origin}/buzz/${buzz.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast({ open: true, message: 'Link copied!', tone: 'success' });
    });
  }

  const authorName =
    buzz.author?.display_name || buzz.author?.username || buzz.author_id.slice(0, 8);
  const authorUsername = buzz.author?.username || '';
  const authorAvatar = buzz.author?.avatar_url;

  const card: React.CSSProperties = {
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.xl,
    padding: `${space[8]}px ${space[9]}px`,
    cursor: 'pointer',
    transition: 'border-color 180ms',
  };

  const actionBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: space[2],
    background: 'none',
    border: 'none',
    color: colors.text.dim,
    fontSize: fontSize.sm,
    cursor: 'pointer',
    padding: `${space[2]}px ${space[3]}px`,
    borderRadius: radius.md,
    transition: 'color 120ms, background 120ms',
  };

  return (
    <>
      <div
        style={card}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = colors.borderStrong;
          initLike();
          initRepost();
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', gap: space[7], marginBottom: space[6] }}>
          <Link
            to={`/u/${authorUsername}`}
            onClick={e => e.stopPropagation()}
            style={{ flexShrink: 0 }}
            aria-label={`View ${authorName}'s profile`}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: colors.accentFaint,
                border: `2px solid ${colors.border}`,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: fontSize.md,
                fontWeight: fontWeight.bold,
                color: colors.accent,
              }}
            >
              {authorAvatar ? (
                <img
                  src={authorAvatar}
                  alt={authorName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                authorName[0]?.toUpperCase()
              )}
            </div>
          </Link>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{ display: 'flex', alignItems: 'baseline', gap: space[3], flexWrap: 'wrap' }}
            >
              <Link
                to={`/u/${authorUsername}`}
                onClick={e => e.stopPropagation()}
                style={{
                  color: colors.text.primary,
                  fontWeight: fontWeight.semibold,
                  fontSize: fontSize.base,
                  textDecoration: 'none',
                }}
              >
                {authorName}
              </Link>
              <span style={{ color: colors.text.muted, fontSize: fontSize.sm }}>
                @{authorUsername}
              </span>
              <span style={{ color: colors.text.faint, fontSize: fontSize.sm }}>·</span>
              <span style={{ color: colors.text.dim, fontSize: fontSize.sm }}>
                {timeAgo(buzz.created_at)}
              </span>
            </div>
          </div>

          {user?.id === buzz.author_id && (
            <button
              onClick={handleDelete}
              aria-label="Delete buzz"
              style={{ ...actionBtn, color: colors.text.faint, marginLeft: 'auto' }}
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <p
          style={{
            margin: `0 0 ${space[6]}px`,
            fontSize: fontSize.md,
            lineHeight: 1.5,
            color: colors.text.primary,
            wordBreak: 'break-word',
          }}
        >
          <BodyText body={buzz.body} />
        </p>

        {/* Image attachment */}
        {buzz.image_url && (
          <button
            type="button"
            style={{
              display: 'block',
              width: '100%',
              marginBottom: space[6],
              cursor: 'zoom-in',
              borderRadius: radius.lg,
              overflow: 'hidden',
              padding: 0,
              border: 'none',
              background: 'transparent',
            }}
            onClick={() => setImgExpanded(true)}
            aria-label="Open buzz attachment"
          >
            <img
              src={buzz.image_url}
              alt="Buzz attachment"
              loading="lazy"
              style={{
                width: '100%',
                maxHeight: compact ? 200 : 360,
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </button>
        )}

        {/* Audio attachment */}
        {buzz.audio_url && (
          <div
            style={{
              marginBottom: space[6],
              padding: `${space[5]}px ${space[7]}px`,
              background: colors.surfaceMuted,
              borderRadius: radius.lg,
            }}
          >
            <p
              style={{
                margin: `0 0 ${space[3]}px`,
                fontSize: fontSize.sm,
                color: colors.text.muted,
              }}
            >
              <Icon name="music" size={13} /> Audio clip
            </p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              controls
              style={{ width: '100%', accentColor: colors.accent }}
              src={buzz.audio_url}
            />
          </div>
        )}

        {/* Video attachment */}
        {buzz.video_url && (
          <div
            style={{
              marginBottom: space[6],
              borderRadius: radius.lg,
              overflow: 'hidden',
              background: '#000',
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              controls
              style={{ width: '100%', maxHeight: compact ? 240 : 420, display: 'block' }}
              src={buzz.video_url}
            />
          </div>
        )}

        {/* Code snippet */}
        {buzz.code_snippet && (
          <div
            style={{
              marginBottom: space[6],
              borderRadius: radius.lg,
              overflow: 'hidden',
              border: `1px solid ${colors.borderStrong}`,
            }}
          >
            {buzz.code_language && (
              <div
                style={{
                  padding: `${space[3]}px ${space[7]}px`,
                  background: colors.borderStrong,
                  fontSize: fontSize.xs,
                  color: colors.accent,
                  fontWeight: fontWeight.semibold,
                  letterSpacing: '0.05em',
                }}
              >
                {LANG_LABELS[buzz.code_language] ?? buzz.code_language.toUpperCase()}
              </div>
            )}
            <pre
              style={{
                margin: 0,
                padding: `${space[7]}px`,
                background: colors.bg,
                color: colors.text.secondary,
                fontFamily: 'monospace',
                fontSize: fontSize.sm,
                overflowX: 'auto',
                whiteSpace: 'pre',
                lineHeight: 1.6,
              }}
            >
              {buzz.code_snippet}
            </pre>
          </div>
        )}

        {/* Attached mix (compact card) */}
        {buzz.attached_mix && (
          <Link
            to={`/mix/${buzz.attached_mix.id}`}
            onClick={e => e.stopPropagation()}
            style={{ display: 'block', textDecoration: 'none', marginBottom: space[6] }}
          >
            <div
              style={{
                display: 'flex',
                gap: space[7],
                alignItems: 'center',
                padding: space[7],
                background: colors.surfaceMuted,
                border: `1px solid ${colors.border}`,
                borderRadius: radius.lg,
              }}
            >
              {buzz.attached_mix.artwork_url && (
                <img
                  src={buzz.attached_mix.artwork_url}
                  alt={buzz.attached_mix.title}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.semibold,
                    color: colors.text.primary,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="headphones" size={13} /> {buzz.attached_mix.title}
                  </span>
                </div>
                <div style={{ fontSize: fontSize.xs, color: colors.text.muted, marginTop: 2 }}>
                  {buzz.attached_mix.dj?.display_name || buzz.attached_mix.dj?.username || ''}
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: space[2], marginTop: space[4] }}>
          {/* Like */}
          <button
            style={{ ...actionBtn, color: liked ? colors.danger : colors.text.dim }}
            onClick={handleLike}
            aria-label={liked ? 'Unlike' : 'Like'}
            aria-pressed={liked ?? false}
          >
            <span style={{ fontSize: 14 }}>{liked ? '♥' : '♡'}</span>
            <span>{likeCount > 0 ? likeCount : ''}</span>
          </button>

          {/* Reply */}
          <Link
            to={`/buzz/${buzz.id}`}
            onClick={e => e.stopPropagation()}
            style={{ ...actionBtn, textDecoration: 'none' }}
            aria-label="Reply"
          >
            <span style={{ fontSize: 14 }}>↩</span>
            <span>{buzz.reply_count > 0 ? buzz.reply_count : ''}</span>
          </Link>

          {/* Repost */}
          <button
            style={{ ...actionBtn, color: reposted ? colors.success : colors.text.dim }}
            onClick={handleRepost}
            aria-label={reposted ? 'Undo repost' : 'Repost'}
            aria-pressed={reposted ?? false}
          >
            <span style={{ fontSize: 14 }}>⟳</span>
            <span>{repostCount > 0 ? repostCount : ''}</span>
          </button>

          {/* Share */}
          <button style={actionBtn} onClick={handleShare} aria-label="Share">
            <span style={{ fontSize: 13 }}>↗</span>
          </button>
        </div>
      </div>

      {/* Expanded image lightbox */}
      {imgExpanded && buzz.image_url && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'zoom-out',
          }}
          onClick={() => setImgExpanded(false)}
        >
          <img
            src={buzz.image_url}
            alt="Buzz attachment"
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain' }}
          />
        </div>
      )}

      <BuzzToast
        open={toast.open}
        message={toast.message}
        tone={toast.tone}
        onClose={() => setToast(t => ({ ...t, open: false }))}
      />
    </>
  );
}

// Renders body with @mention links and #tag highlights
function BodyText({ body }: { body: string }) {
  const parts: Array<{ type: 'text' | 'mention' | 'hashtag'; value: string }> = [];
  const re = /(@[A-Za-z0-9_]+|#[A-Za-z0-9_]+)/g;
  let last = 0,
    m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: body.slice(last, m.index) });
    const v = m[1];
    parts.push({ type: v[0] === '@' ? 'mention' : 'hashtag', value: v });
    last = m.index + v.length;
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) });

  return (
    <>
      {parts.map((p, i) =>
        p.type === 'mention' ? (
          <Link
            key={i}
            to={`/u/${p.value.slice(1)}`}
            style={{ color: colors.accent, textDecoration: 'none', fontWeight: 500 }}
            onClick={e => e.stopPropagation()}
          >
            {p.value}
          </Link>
        ) : p.type === 'hashtag' ? (
          <Link
            key={i}
            to={`/search?q=${encodeURIComponent(p.value)}`}
            style={{ color: colors.info, textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            {p.value}
          </Link>
        ) : (
          <span key={i}>{p.value}</span>
        )
      )}
    </>
  );
}
