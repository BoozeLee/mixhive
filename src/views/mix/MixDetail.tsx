'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlayer } from '@/lib/player-store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CDNOptimizedImage } from '@/components/CDNOptimizedImage';
import { MixAudioIntelligence } from '@/components/MixAudioIntelligence';
import { NftMintModal } from '@/components/NftMintModal';
import { useAuth } from '@/hooks/useAuth';
import { getMix, like, unlike, hasLiked, repost, unrepost, hasReposted } from '@/lib/api';
import type { Mix } from '@/lib/types';

export function MixDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playTrack, state } = usePlayer();
  const { user, profile } = useAuth();

  const [mix, setMix] = useState<(Mix & { dj?: { id: string; username: string; display_name: string; avatar_url?: string }; genre_name?: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showNftModal, setShowNftModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);

  useEffect(() => {
    if (id) fetchMix();
  }, [id]);

  const fetchMix = async () => {
    if (!id) return;
    try {
      const data = await getMix(id);
      if (!data) { setError('Mix not found'); return; }
      setMix(data as typeof mix);
      if (user) {
        const [liked, reposted] = await Promise.all([
          hasLiked(user.id, id),
          hasReposted(user.id, id),
        ]);
        setIsLiked(liked);
        setIsReposted(reposted);
      }
    } catch (err) {
      setError('Failed to load mix');
      console.error('Mix fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = () => {
    if (mix) {
      playTrack({
        id: mix.id,
        title: mix.title,
        artist: mix.dj?.display_name ?? 'Unknown',
        url: mix.audio_url,
        artwork: mix.artwork_url ?? undefined,
        duration: mix.duration_seconds ?? 0,
      });
    }
  };

  const handleLike = async () => {
    if (!mix || !user) return;
    if (isLiked) {
      setIsLiked(false);
      setMix(prev => prev ? { ...prev, like_count: (prev.like_count ?? 0) - 1 } : prev);
      await unlike(user.id, mix.id);
    } else {
      setIsLiked(true);
      setMix(prev => prev ? { ...prev, like_count: (prev.like_count ?? 0) + 1 } : prev);
      await like(user.id, mix.id);
    }
  };

  const handleRepost = async () => {
    if (!mix || !user) return;
    if (isReposted) {
      setIsReposted(false);
      await unrepost(mix.id);
    } else {
      setIsReposted(true);
      await repost(user.id, mix.id, mix.dj_id);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}:${remaining.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !mix) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h1 className="text-2xl text-red-400 mb-2">Error</h1>
          <p className="text-gray-400">{error || 'Mix not found'}</p>
          <button onClick={() => navigate('/feed')} className="mt-4 px-4 py-2 btn btn-secondary">
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  const isOwner = profile?.id === mix.dj_id;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white mb-6 flex items-center space-x-2"
        >
          <span>←</span>
          <span>Back</span>
        </button>

        {/* Mix Header */}
        <div className="bg-gray-900 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="aspect-square bg-gray-800 rounded-lg overflow-hidden">
                <CDNOptimizedImage
                  src={mix.artwork_url ?? undefined}
                  alt={mix.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="md:col-span-2 space-y-4">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {mix.title}
                  {mix.is_explicit && <span className="ml-2 text-red-400 text-sm">EXPLICIT</span>}
                </h1>
                <div className="flex items-center space-x-4 text-gray-400 text-sm">
                  <button onClick={() => navigate(`/u/${mix.dj?.username}`)} className="hover:text-yellow-400">
                    by {mix.dj?.display_name ?? 'Unknown'}
                  </button>
                  <span>•</span>
                  <span>{formatDate(mix.created_at)}</span>
                  <span>•</span>
                  <span>{formatDuration(mix.duration_seconds)}</span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <button onClick={handlePlay} className="btn btn-primary flex items-center space-x-2">
                  <span>{state.isPlaying && state.currentTrack?.id === mix.id ? '⏸' : '▶'}</span>
                  <span>Play</span>
                </button>

                <button
                  onClick={handleLike}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                    isLiked ? 'bg-red-900 text-red-400 border border-red-700' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span>❤️</span>
                  <span>{mix.like_count ?? 0}</span>
                </button>

                <button
                  onClick={handleRepost}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                    isReposted ? 'bg-green-900 text-green-400 border border-green-700' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span>🔄</span>
                </button>

                <button
                  onClick={() => setShowComments(!showComments)}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
                >
                  <span>💬</span>
                  <span>{mix.comment_count ?? 0}</span>
                </button>
              </div>

              <div className="flex items-center space-x-6 text-sm text-gray-400">
                <div className="flex items-center space-x-1">
                  <span>🎵</span>
                  <span>{(mix.play_count ?? 0).toLocaleString()} plays</span>
                </div>
                {mix.genre_name && (
                  <div className="flex items-center space-x-1">
                    <span>🎧</span>
                    <span>{mix.genre_name}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {mix.tags && mix.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mix.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-gray-800 text-gray-300 rounded-full text-sm">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* NFT pass CTA */}
              <button
                onClick={() => setShowNftModal(true)}
                style={{ background: isOwner ? 'rgba(240,192,64,0.1)' : 'rgba(255,255,255,0.05)', color: isOwner ? '#f0c040' : '#9ca3af', border: `1px solid ${isOwner ? 'rgba(240,192,64,0.25)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 6, fontSize: 13, padding: '7px 14px', cursor: 'pointer' }}
              >
                🪙 {isOwner ? 'Mint a limited edition pass' : 'Claim a pass'}
              </button>
            </div>
          </div>
        </div>

        {/* NFT Modal */}
        <NftMintModal
          isOpen={showNftModal}
          onClose={() => setShowNftModal(false)}
          sourceType="mix"
          sourceId={mix.id}
          defaultConfig={{
            name: `${mix.title} — Limited Pass`,
            description: `Early supporter pass for ${mix.title}`,
            image_url: mix.artwork_url ?? undefined,
            soulbound: false,
          }}
        />

        {/* Description */}
        {mix.description && (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Description</h2>
            <p className="text-gray-300 leading-relaxed">{mix.description}</p>
          </div>
        )}

        {/* Tracklist */}
        {mix.tracklist && mix.tracklist.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Tracklist</h2>
            <div className="space-y-3">
              {mix.tracklist.map((track, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-800 rounded-md">
                  <div className="flex items-center space-x-4">
                    <span className="text-gray-400 w-8">#{index + 1}</span>
                    <div>
                      <div className="text-white font-medium">{track.title}</div>
                      {track.artist && <div className="text-gray-400 text-sm">{track.artist}</div>}
                    </div>
                  </div>
                  {track.start_time != null && (
                    <span className="text-gray-400 text-sm">{formatDuration(track.start_time)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audio Intelligence — Phase 4 */}
        <div className="mb-8">
          <MixAudioIntelligence mix={mix} isOwner={isOwner} />
        </div>

        {/* Comments */}
        {showComments && (
          <div className="bg-gray-900 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Comments ({mix.comment_count ?? 0})</h2>
            <p className="text-gray-500 text-sm">Comments coming soon.</p>
          </div>
        )}

        {/* Artist info */}
        {mix.dj && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">About {mix.dj.display_name}</h2>
            <div className="flex items-center space-x-4">
              <div
                className="w-16 h-16 rounded-full bg-gray-800"
                style={{
                  backgroundImage: mix.dj.avatar_url ? `url(${mix.dj.avatar_url})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div>
                <h3 className="text-lg font-semibold text-white">@{mix.dj.username}</h3>
                <button
                  onClick={() => navigate(`/u/${mix.dj?.username}`)}
                  className="text-sm text-yellow-400 hover:text-yellow-300 mt-1"
                >
                  View Profile →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
