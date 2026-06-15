import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePlayer } from '../lib/playerStore';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { Icon } from '../components/ui/Icon';
import { Button } from '../components/ui/Button';
import { colors } from '../styles/tokens';
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
import { HiveButton } from '../components/hive/HiveButton';
import { SimilarMixesPanel } from '../components/SimilarMixesPanel';
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
  const { play, addToQueue } = usePlayer();
  const [fansAlsoLiked, setFansAlsoLiked] = useState<FeedMix[]>([]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
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
      }
      setLoading(false);
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
  if (!mix) return <NotFoundState what="mix" />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px' }}>
      <div
        style={{
          width: '100%',
          aspectRatio: '1/1',
          maxHeight: 320,
          borderRadius: 12,
          background: mix.artwork_url
            ? `url(${mix.artwork_url}) center/cover`
            : `linear-gradient(135deg, ${colors.surfaceHover}, ${colors.accentFaint})`,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 48,
          color: colors.accentFaint,
        }}
      >
        {!mix.artwork_url && '♪'}
      </div>

      <div style={{ marginBottom: 20 }}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, color: colors.text.primary, margin: '0 0 4px' }}
        >
          {mix.title}
        </h1>
        {mix.dj && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              to={`/u/${mix.dj.username}`}
              style={{ color: colors.text.dimmed, fontSize: 14, textDecoration: 'none' }}
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
          <p style={{ color: colors.text.dim, fontSize: 14, marginTop: 12, lineHeight: 1.6 }}>
            {mix.description}
          </p>
        )}
      </div>

      <WaveformPlayer src={mix.audio_url} waveformUrl={mix.waveform_url} onPlay={handlePlay} />

      <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center' }}>
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
          {liked ? '♥' : '♡'} <span style={{ fontSize: 14 }}>{likeCount}</span>
        </button>
        <span style={{ color: colors.text.faint, fontSize: 14 }}>{mix.play_count} plays</span>
        {mix.genre_name && (
          <span style={{ color: colors.text.faint, fontSize: 13 }}>{mix.genre_name}</span>
        )}
        <span
          style={{
            background: colors.surfaceHover,
            color: colors.text.dim,
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 600,
            marginLeft: 'auto',
          }}
        >
          {mix.audio_quality === 'original' ? 'HQ Audio' : mix.audio_quality || 'MP3'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
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
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <Icon name="edit" size={13} color="currentColor" />
            {t('edit')}
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
            borderRadius: 8,
            padding: 12,
          }}
        >
          <p style={{ color: colors.text.muted, fontSize: 12, marginBottom: 6 }}>
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
              borderRadius: 6,
              fontSize: 12,
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
                borderRadius: 12,
                fontSize: 12,
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
            style={{ fontSize: 14, fontWeight: 600, color: colors.text.secondary, marginBottom: 8 }}
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
              fontSize: 14,
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

      <SimilarMixesPanel mixId={mix.id} />

      <div style={{ marginTop: 32 }}>
        <h3
          style={{ fontSize: 14, fontWeight: 600, color: colors.text.secondary, marginBottom: 12 }}
        >
          Comments ({comments.length})
        </h3>

        {user ? (
          <form onSubmit={handleComment}>
            {replyTo && (
              <div style={{ fontSize: 12, color: colors.text.muted, marginBottom: 6 }}>
                Replying to a comment{' '}
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.accent,
                    cursor: 'pointer',
                    fontSize: 12,
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
                  borderRadius: 8,
                  fontSize: 14,
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
              <div style={{ background: colors.surface, borderRadius: 8, padding: '10px 14px' }}>
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
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {t('reply')}
                  </button>
                </div>
                <p style={{ color: colors.text.secondary, fontSize: 14, margin: 0 }}>
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
                      borderRadius: 8,
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
                          fontSize: 12,
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        {r.user?.display_name || r.user?.username}
                      </Link>
                      <span
                        style={{ color: colors.text.faintest, fontSize: 10, marginLeft: 'auto' }}
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
