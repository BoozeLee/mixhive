import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../lib/playerStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { colors, fontSize, layout, radius, space } from '../styles/tokens';
import { BpmChip } from '../components/BpmChip';
import { KeyChip } from '../components/KeyChip';
import {
  getMix,
  getComments,
  createComment,
  like,
  unlike,
  hasLiked,
  incrementPlayCount,
  repost,
  unrepost,
  hasReposted,
  getFansAlsoLiked,
} from '../lib/api';
import { WaveformPlayer } from '../components/WaveformPlayer';
import { SkeletonMixDetail } from '../components/Skeleton';
import { FollowButton } from '../components/FollowButton';
import { ReportButton } from '../components/ReportButton';
import { AddToPlaylistModal } from '../components/AddToPlaylistModal';
import { MentionRenderer } from '../components/MentionRenderer';
import { MixCard } from '../components/MixCard';
import { MixAgentHints } from '../components/MixAgentHints';
import { MixAudioIntelligence } from '../components/MixAudioIntelligence';
import { NotFoundState } from '../components/EmptyState';
import { StartMythicSessionModal } from '../components/StartMythicSessionModal';
import { NftMintModal } from '../components/NftMintModal';
import { SimilarMixesPanel } from '../components/SimilarMixesPanel';
import { AiBandBadge } from '../components/AiBandBadge';
import { AgentBandCredits } from '../components/AgentBandCredits';
import { meetsTier } from '../lib/subscription';
import type { Mix, Comment as CommentType, FeedMix } from '../lib/types';

const WEB3_ENABLED = process.env.NEXT_PUBLIC_WEB3_EXPERIMENTS_ENABLED === 'true';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

export function MixDetail() {
  const t = useTranslations('mixDetail');
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [mix, setMix] = useState<Mix | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [showMythicSession, setShowMythicSession] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [canAccess, setCanAccess] = useState(true);
  const [loadError, setLoadError] = useState('');
  const { play, addToQueue } = usePlayer();
  const [fansAlsoLiked, setFansAlsoLiked] = useState<FeedMix[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    getMix(id).then(async m => {
      setMix(m);
      if (m) {
        setLikeCount(m.like_count);
        const [c, liked, f, rp] = await Promise.all([
          getComments(m.id),
          user ? hasLiked(user.id, m.id) : Promise.resolve(false),
          getFansAlsoLiked(m.id),
          user ? hasReposted(user.id, m.id) : Promise.resolve(false),
        ]);
        setComments(c);
        setFansAlsoLiked(f);
        if (typeof liked === 'boolean') setLiked(liked);
        if (typeof rp === 'boolean') setReposted(rp);

        // Check premium access
        if (m.required_tier && m.required_tier !== 'free' && m.dj_id !== user?.id) {
          if (!user) {
            setCanAccess(false);
          } else {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              const res = await fetch('/api/subscription/status', { headers: { Authorization: `Bearer ${session.access_token}` } });
              if (res.ok) {
                const sub = await res.json();
                setCanAccess(meetsTier(sub.tier || 'free', m.required_tier));
              } else {
                setCanAccess(false);
              }
            } else {
              setCanAccess(false);
            }
          }
        }
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
      setLoadError('Failed to load mix');
    });
  }, [id, user]);

  // Realtime: new comments + live like-count updates for everyone viewing
  // this mix. Mirrors the NotificationsBell channel pattern.
  useEffect(() => {
    if (!isSupabaseConfigured || !id) return;
    const channel = supabase
      .channel(`mix:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'comments', filter: `mix_id=eq.${id}` },
        () => {
          void getComments(id).then(setComments);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'comments', filter: `mix_id=eq.${id}` },
        () => {
          void getComments(id).then(setComments);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'likes', filter: `mix_id=eq.${id}` },
        payload => {
          // Skip our own like — it was already counted optimistically.
          if (user && (payload.new as { user_id?: string }).user_id === user.id) return;
          setLikeCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'likes', filter: `mix_id=eq.${id}` },
        payload => {
          if (user && (payload.old as { user_id?: string }).user_id === user.id) return;
          setLikeCount(prev => Math.max(prev - 1, 0));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  function handlePlay() {
    if (id) incrementPlayCount(id, user?.id);
  }

  async function toggleLike() {
    if (!user || !mix) return;
    if (liked) {
      await unlike(user.id, mix.id);
      setLikeCount(prev => prev - 1);
    } else {
      await like(user.id, mix.id);
      setLikeCount(prev => prev + 1);
    }
    setLiked(!liked);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !id || !commentBody.trim()) return;
    const comment = await createComment({
      user_id: user.id,
      mix_id: id,
      body: commentBody.trim(),
      parent_id: replyTo,
    });
    if (comment) {
      setCommentBody('');
      setReplyTo(null);
      getComments(id).then(setComments);
    }
  }

  if (loading) return <SkeletonMixDetail />;
  if (loadError) {
    return (
      <div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto', padding: 32, textAlign: 'center' }}>
        <p style={{ color: colors.danger, marginBottom: 16 }}>{loadError}</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }
  if (!mix) return <NotFoundState what="mix" />;

  return (
    <div style={{ maxWidth: layout.contentMaxWidth, margin: '0 auto', padding: `${space[6]}px ${space[8]}px` }}>
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          maxHeight: 320,
          borderRadius: radius['2xl'],
          background: mix.artwork_url
            ? `url(${mix.artwork_url}) center/cover`
            : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
          marginBottom: space[10],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          color: colors.accentFaint,
        }}
      >
        {!mix.artwork_url && '♪'}
      </div>

      <div style={{ marginBottom: space[10] }}>
        <h1
          style={{ fontSize: fontSize['3xl'], fontWeight: 700, color: colors.text.primary, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {mix.title}
          {mix.required_tier && mix.required_tier !== 'free' && (
            <span
              style={{
                fontSize: fontSize.xs,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: radius.md,
                background: colors.accent,
                color: colors.black,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {mix.required_tier}
            </span>
          )}
        </h1>
        {mix.ai_band && (
          <div style={{ margin: '0 0 6px' }}>
            <AiBandBadge size="md" />
          </div>
        )}
        {mix.dj && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to={`/u/${mix.dj.username}`}
              style={{ color: colors.text.dimmed, fontSize: fontSize.md, textDecoration: 'none' }}
            >
              {mix.dj.display_name || mix.dj.username}
            </Link>
            {user && user.id !== mix.dj_id && (
              <FollowButton targetUserId={mix.dj_id} currentUserId={user.id} />
            )}
            {user && user.id !== mix.dj_id && (
              <ReportButton sourceTable="mixes" sourceId={mix.id} />
            )}
          </div>
        )}
        {mix.description && (
          <p style={{ color: colors.text.dim, fontSize: fontSize.md, marginTop: 12, lineHeight: 1.6 }}>
            {mix.description}
          </p>
        )}
      </div>

      {!canAccess && mix.required_tier && mix.required_tier !== 'free' ? (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            background: `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.surface})`,
            border: `1px solid ${colors.accent}33`,
            borderRadius: radius['2xl'],
            marginTop: 20,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <p style={{ color: colors.text.primary, fontWeight: 600, margin: '0 0 4px' }}>
            Premium Mix
          </p>
          <p style={{ color: colors.text.muted, fontSize: 13, margin: '0 0 16px' }}>
            This mix requires a {mix.required_tier} subscription
          </p>
          <Link
            to="/pricing"
            style={{
              display: 'inline-block',
              background: colors.accent,
              color: colors.black,
              padding: '10px 24px',
              borderRadius: radius.lg,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: fontSize.md,
            }}
          >
            Unlock with {mix.required_tier}
          </Link>
        </div>
      ) : (
        <WaveformPlayer src={mix.audio_url} waveformUrl={mix.waveform_url} onPlay={handlePlay} />
      )}

      <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={t('like')}
          style={{
            background: 'transparent',
            border: 'none',
            color: liked ? colors.accent : colors.text.faint,
            cursor: 'pointer',
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {liked ? '♥' : '♡'} <span style={{ fontSize: fontSize.md }}>{likeCount}</span>
        </button>
        <span style={{ color: colors.text.faint, fontSize: fontSize.md }}>{mix.play_count} plays</span>
        {mix.genre_name && (
          <span style={{ color: colors.text.faint, fontSize: 13 }}>{mix.genre_name}</span>
        )}
        {mix.mood && (
          <span
            style={{
              color: colors.text.dim,
              fontSize: 11,
              padding: '1px 6px',
              border: `1px solid ${colors.border}`,
              borderRadius: radius.sm,
              textTransform: 'capitalize',
            }}
          >
            {mix.mood}
          </span>
        )}
        {mix.bpm && <BpmChip bpm={mix.bpm} size="sm" />}
        {mix.musical_key && <KeyChip keyCamelot={mix.musical_key} />}
        <span
          style={{
            background: colors.surfaceHover,
            color: colors.text.dim,
            fontSize: fontSize.xs,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 600,
            marginLeft: 'auto',
          }}
        >
          {mix.audio_quality === 'original' ? 'HQ Audio' : mix.audio_quality || 'MP3'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button
          variant={shareCopied ? 'success' : 'secondary'}
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 2000);
          }}
        >
          {shareCopied ? '✓ Copied' : '🔗 Share'}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowEmbed(!showEmbed)}>
          {'</>'} Embed
        </Button>
        {user && (
          <Button
            variant={reposted ? 'success' : 'secondary'}
            size="sm"
            disabled={repostBusy}
            loading={repostBusy}
            onClick={async () => {
              if (!mix || repostBusy) return;
              setRepostBusy(true);
              const prev = reposted;
              setReposted(!prev);
              try {
                if (prev) {
                  await unrepost(mix.id);
                } else {
                  await repost(user.id, mix.id, mix.dj_id);
                }
              } catch {
                setReposted(prev);
              } finally {
                setRepostBusy(false);
              }
            }}
          >
            {reposted ? '✓ Reposted' : '↻ Repost'}
          </Button>
        )}
        {user && (
          <>
            <Button
              size="sm"
              onClick={() => {
                play(
                  {
                    id: mix.id,
                    title: mix.title,
                    djName: mix.dj?.display_name || mix.dj?.username || '',
                    djUsername: mix.dj?.username || '',
                    artworkUrl: mix.artwork_url,
                    audioUrl: mix.audio_url,
                  },
                  { clearQueue: true }
                );
              }}
            >
              ▶ Play
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                addToQueue({
                  id: mix.id,
                  title: mix.title,
                  djName: mix.dj?.display_name || mix.dj?.username || '',
                  djUsername: mix.dj?.username || '',
                  artworkUrl: mix.artwork_url,
                  audioUrl: mix.audio_url,
                });
              }}
            >
              + Queue
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAddToPlaylist(true)}>
              + Playlist
            </Button>
          </>
        )}
        {showAddToPlaylist && user && (
          <AddToPlaylistModal
            mixId={mix.id}
            userId={user.id}
            onClose={() => setShowAddToPlaylist(false)}
          />
        )}
        {user && mix.dj_id === user.id && (
          <Link
            to={`/mix/${mix.id}/edit`}
            style={{
              textDecoration: 'none',
              background: 'transparent',
              border: `1px solid ${colors.borderStrong}`,
              color: colors.text.muted,
              padding: '6px 14px',
              borderRadius: radius.md,
              cursor: 'pointer',
              fontSize: fontSize.sm,
            }}
          >
            <Icon name="edit" size={13} color="currentColor" />
            {t('edit')}
          </Link>
        )}
        {user && mix.dj_id === user.id && (
          <Link
            to={`/mix/${mix.id}/analytics`}
            style={{
              textDecoration: 'none',
              background: 'transparent',
              border: `1px solid ${colors.accent}44`,
              color: colors.accent,
              padding: '6px 14px',
              borderRadius: radius.md,
              cursor: 'pointer',
              fontSize: fontSize.sm,
            }}
          >
            📊 Analytics
          </Link>
        )}
        {WEB3_ENABLED && user && mix.dj_id === user.id && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMintModal(true)}
            leftIcon={<Icon name="sparkles" size={14} color="currentColor" />}
          >
            {t('supporterPass')}
          </Button>
        )}
      </div>

      {showEmbed && (
        <div
          style={{
            marginTop: 12,
            background: colors.surfaceMuted,
            border: `1px solid ${colors.borderSubtle}`,
            borderRadius: radius.lg,
            padding: 12,
          }}
        >
          <p style={{ color: colors.text.muted, fontSize: fontSize.sm, marginBottom: 6 }}>
            {t('embedHtml')}
          </p>
          <textarea
            readOnly
            rows={4}
            value={`<iframe src="${window.location.origin}/embed/mix/${mix.id}" width="100%" height="160" frameborder="0" style="border-radius:8px"></iframe>`}
            onClick={e => (e.target as HTMLTextAreaElement).select()}
            style={{
              width: '100%',
              background: colors.surface,
              border: `1px solid ${colors.borderSubtle}`,
              color: colors.text.muted,
              padding: 8,
              borderRadius: radius.md,
              fontSize: fontSize.sm,
              resize: 'none',
            }}
          />
        </div>
      )}

      {mix.tags && mix.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 16 }}>
          {mix.tags.map(t => (
            <span
              key={t}
              style={{
                background: colors.surfaceHover,
                color: colors.text.dim,
                padding: '4px 10px',
                borderRadius: radius['2xl'],
                fontSize: fontSize.sm,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {mix.tracklist && mix.tracklist.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3
            style={{ fontSize: fontSize.md, fontWeight: 600, color: colors.text.secondary, marginBottom: 8 }}
          >
            {t('tracklist')}
          </h3>
          <div style={{ fontSize: 13, color: colors.text.muted, lineHeight: 2 }}>
            {(mix.tracklist as { artist: string; title: string }[]).map((t, i) => (
              <div key={i}>
                {i + 1}. {t.artist} — {t.title}
              </div>
            ))}
          </div>
        </div>
      )}

      <MixAudioIntelligence mix={mix} isOwner={user?.id === mix.dj_id} />

      <MixAgentHints mix={mix} djUsername={mix.dj?.username} />

      {fansAlsoLiked.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3
            style={{
              fontSize: fontSize.md,
              fontWeight: 600,
              color: colors.text.secondary,
              marginBottom: 12,
            }}
          >
            {t('fansAlsoLiked')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fansAlsoLiked.map(m => (
              <MixCard key={m.id} mix={m} />
            ))}
          </div>
        </div>
      )}

      <AgentBandCredits mixId={mix.id} />

      <SimilarMixesPanel mixId={mix.id} />

      <div style={{ marginTop: 32 }}>
        <h3
          style={{ fontSize: fontSize.md, fontWeight: 600, color: colors.text.secondary, marginBottom: 12 }}
        >
          Comments ({comments.length})
        </h3>

        {user ? (
          <form onSubmit={handleComment}>
            {replyTo && (
              <div style={{ fontSize: fontSize.sm, color: colors.text.muted, marginBottom: 6 }}>
                Replying to a comment{' '}
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.accent,
                    cursor: 'pointer',
                    fontSize: fontSize.sm,
                  }}
                >
                  cancel
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder={t('commentPlaceholder')}
                required
                style={{
                  flex: 1,
                  background: colors.surface,
                  border: `1px solid ${colors.borderSubtle}`,
                  color: colors.text.primary,
                  padding: '10px 14px',
                  borderRadius: radius.lg,
                  fontSize: fontSize.md,
                }}
              />
              <Button type="submit">{t('post')}</Button>
            </div>
          </form>
        ) : (
          <p style={{ color: colors.text.faintest, fontSize: 13 }}>
            <Link to="/login" style={{ color: colors.accent }}>
              {t('signIn')}
            </Link>{' '}
            to comment
          </p>
        )}

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map(c => (
            <div key={c.id}>
              <div style={{ background: colors.surface, borderRadius: radius.lg, padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {c.user?.avatar_url && (
                    <img
                      src={c.user.avatar_url}
                      alt={`${c.user.display_name || c.user.username}'s avatar`}
                      style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  <Link
                    to={`/u/${c.user?.username}`}
                    style={{
                      color: colors.accent,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    {c.user?.display_name || c.user?.username}
                  </Link>
                  <span style={{ color: colors.text.faintest, fontSize: 11, marginLeft: 'auto' }}>
                    {timeAgo(c.created_at)}
                  </span>
                  <button
                    onClick={() => setReplyTo(c.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.text.faintest,
                      fontSize: fontSize.sm,
                      cursor: 'pointer',
                    }}
                  >
                    {t('reply')}
                  </button>
                </div>
                <p style={{ color: colors.text.secondary, fontSize: fontSize.md, margin: 0 }}>
                  <MentionRenderer body={c.body} />
                </p>
              </div>
              {c.replies &&
                c.replies.map(r => (
                  <div
                    key={r.id}
                    style={{
                      marginLeft: 24,
                      marginTop: 8,
                      background: colors.surfaceMuted,
                      borderRadius: radius.lg,
                      padding: '8px 12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {r.user?.avatar_url && (
                        <img
                          src={r.user.avatar_url}
                          alt={`${r.user.display_name || r.user.username}'s avatar`}
                          style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      )}
                      <Link
                        to={`/u/${r.user?.username}`}
                        style={{
                          color: colors.accent,
                          fontSize: fontSize.sm,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        {r.user?.display_name || r.user?.username}
                      </Link>
                      <span
                        style={{ color: colors.text.faintest, fontSize: fontSize.xs, marginLeft: 'auto' }}
                      >
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                    <p style={{ color: colors.text.secondary, fontSize: 13, margin: 0 }}>
                      <MentionRenderer body={r.body} />
                    </p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* Mythic Session entry (polish tranche — button can be wired in action bar in 1 line) */}
      <StartMythicSessionModal
        isOpen={showMythicSession}
        onClose={() => setShowMythicSession(false)}
      />

      {WEB3_ENABLED && mix && (
        <NftMintModal
          isOpen={showMintModal}
          onClose={() => setShowMintModal(false)}
          sourceType="mix"
          sourceId={mix.id}
          defaultConfig={{ name: `${mix.title} — supporter pass` }}
        />
      )}
    </div>
  );
}
