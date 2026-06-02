import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { runStrategicAgent } from '../lib/agents';
import type { AgentOutput } from '../lib/agents';
import { EnhancedProfileHeader } from '../components/EnhancedProfileHeader';
import { MixGallery } from '../components/MixGallery';
import { SkeletonProfile } from '../components/Skeleton';
import { NotFoundState } from '../components/EmptyState';
import {
  getProfile,
  getMixesByDj,
  getFollowersCount,
  getFollowingCount,
  getPlaylistsByUser,
  getUserActivity,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Profile, Mix, Playlist, ActivityEvent } from '../lib/types';

export function EnhancedProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mixes, setMixes] = useState<Mix[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'mixes' | 'playlists' | 'activity' | 'passes'>('mixes');

  const isOwnProfile = user && profile?.id === user.id;
  const [coachResult, setCoachResult] = useState<AgentOutput | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);

  async function runProfileCoach() {
    setCoachBusy(true);
    setCoachError(null);
    try {
      const result = await runStrategicAgent('profile_coach', {}, false);
      setCoachResult(result);
      setCoachOpen(true);
    } catch (err) {
      setCoachError(err instanceof Error ? err.message : 'Profile Coach failed');
    } finally {
      setCoachBusy(false);
    }
  }

  useEffect(() => {
    if (!username) return;
    setLoading(true);

    const loadProfileData = async () => {
      try {
        // Load profile
        const profileData = await getProfile(username);
        if (!profileData) {
          setProfile(null);
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Load all data in parallel
        const [mixesData, followersData, followingData, playlistsData, activityData] =
          await Promise.all([
            getMixesByDj(profileData.id),
            getFollowersCount(profileData.id),
            getFollowingCount(profileData.id),
            getPlaylistsByUser(profileData.id),
            getUserActivity(profileData.id),
          ]);

        setMixes(mixesData);
        setPlaylists(playlistsData);
        setActivity(activityData);
        setFollowersCount(followersData);
        setFollowingCount(followingData);
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [username, user]);

  if (loading) return <SkeletonProfile />;
  if (!profile) return <NotFoundState what="DJ" />;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Enhanced Profile Header */}
      <EnhancedProfileHeader
        profile={profile}
        followersCount={followersCount}
        followingCount={followingCount}
        mixesCount={mixes.length}
        isOwnProfile={!!isOwnProfile}
      />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-700 mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('mixes')}
              aria-label={`Show mixes, ${mixes.length} total`}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'mixes'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🎵</span>
                <span>Mixes</span>
                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {mixes.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('playlists')}
              aria-label={`Show playlists, ${playlists.length} total`}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'playlists'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🎧</span>
                <span>Playlists</span>
                <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full text-xs">
                  {playlists.length}
                </span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              aria-label="Show activity"
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'activity'
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>📊</span>
                <span>Activity</span>
              </div>
            </button>

            <button
              onClick={() => setActiveTab('passes')}
              aria-label="Show NFT passes"
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'passes'
                  ? 'border-yellow-500 text-yellow-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🪙</span>
                <span>NFT Passes</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'mixes' && (
          <MixGallery mixes={mixes} currentUserId={user?.id} showControls={!isOwnProfile} />
        )}

        {activeTab === 'playlists' && (
          <div>
            {playlists.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🎧</div>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No playlists yet</h3>
                <p className="text-gray-500 text-sm">
                  Create playlists to organize your favorite mixes.
                </p>
                {isOwnProfile && (
                  <button className="mt-4 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
                    Create Playlist
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {playlists.map(playlist => (
                  <Link key={playlist.id} to={`/playlist/${playlist.id}`} className="group block">
                    <div className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-colors">
                      {playlist.artwork_url ? (
                        <img
                          src={playlist.artwork_url}
                          alt={playlist.title}
                          className="w-full h-32 object-cover"
                        />
                      ) : (
                        <div className="w-full h-32 bg-gradient-to-br from-purple-900/50 to-blue-900/50 flex items-center justify-center">
                          <span className="text-3xl">🎧</span>
                        </div>
                      )}
                      <div className="p-4">
                        <h3 className="font-semibold text-white mb-1">{playlist.title}</h3>
                        <p className="text-gray-400 text-sm mb-2">{playlist.mix_count} mixes</p>
                        <p className="text-gray-500 text-xs line-clamp-2">
                          {playlist.description || 'No description'}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div>
            {activity.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">No recent activity</h3>
                <p className="text-gray-500 text-sm">
                  Your activity will appear here once you start interacting.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {activity.slice(0, 10).map((event, index) => (
                    <div key={index} className="bg-gray-800 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl">
                          {event.activity_type === 'upload' && '🎵'}
                          {event.activity_type === 'like' && '❤️'}
                          {event.activity_type === 'follow' && '⊞'}
                        </div>
                        <div className="flex-1">
                          <p className="text-white">
                            {event.activity_type === 'upload' && (
                              <>
                                Uploaded{' '}
                                <Link
                                  to={`/mix/${event.mix_id}`}
                                  className="text-purple-400 hover:text-purple-300"
                                >
                                  "{event.mix_title}"
                                </Link>
                              </>
                            )}
                            {event.activity_type === 'like' && (
                              <>
                                Liked{' '}
                                <Link
                                  to={`/mix/${event.mix_id}`}
                                  className="text-purple-400 hover:text-purple-300"
                                >
                                  "{event.mix_title}"
                                </Link>
                              </>
                            )}
                            {event.activity_type === 'follow' && (
                              <>
                                Followed{' '}
                                <Link
                                  to={`/u/${event.target_username}`}
                                  className="text-purple-400 hover:text-purple-300"
                                >
                                  {event.target_display_name || event.target_username}
                                </Link>
                              </>
                            )}
                          </p>
                          <p className="text-gray-400 text-sm">
                            {new Date(event.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isOwnProfile && (
        <div style={{ marginTop: 24, border: '1px solid rgba(240,192,64,0.22)', borderRadius: 12, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setCoachOpen(o => !o)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
              background: 'rgba(240,192,64,0.06)',
              border: 'none',
              cursor: 'pointer',
              color: '#f0c040',
              fontWeight: 800,
              fontSize: 13,
            }}
          >
            <span>⬡ Profile Coach</span>
            <span style={{ fontSize: 11, color: '#666' }}>{coachOpen ? '▲' : '▼'}</span>
          </button>

          {coachOpen && (
            <div style={{ padding: '12px 16px 16px' }}>
              <button
                type="button"
                onClick={runProfileCoach}
                disabled={coachBusy}
                style={{
                  border: '1px solid #f0c040',
                  borderRadius: 8,
                  background: coachBusy ? '#333' : '#f0c040',
                  color: coachBusy ? '#888' : '#0a0a0a',
                  padding: '8px 14px',
                  fontWeight: 800,
                  fontSize: 12,
                  cursor: coachBusy ? 'default' : 'pointer',
                  marginBottom: 12,
                }}
              >
                {coachBusy ? 'Running…' : 'Run Profile Coach'}
              </button>

              {coachError && <p style={{ color: '#e05', fontSize: 13, margin: '0 0 10px' }}>{coachError}</p>}

              {coachResult && coachResult.suggestions.length === 0 && (
                <p style={{ color: '#555', fontSize: 13 }}>Profile looks solid — no suggestions right now.</p>
              )}

              {coachResult && coachResult.suggestions.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid #222',
                    borderRadius: 10,
                    padding: '10px 12px',
                    marginBottom: 8,
                    background: 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#f0c040', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                      {s.type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ color: '#555', fontSize: 11 }}>{Math.round(s.confidence * 100)}%</span>
                  </div>
                  <p style={{ margin: 0, color: '#bbb', fontSize: 13, lineHeight: 1.5 }}>{s.rationale}</p>
                </div>
              ))}

              {coachResult && (
                <a href="/agents/inbox" style={{ color: '#f0c040', fontSize: 12 }}>
                  View all in agents inbox →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* NFT Passes tab */}
      {activeTab === 'passes' && (
        <div>
          <NftPassesSection profileId={profile.id} isOwnProfile={!!isOwnProfile} />
        </div>
      )}
    </div>
  );
}

function NftPassesSection({ profileId, isOwnProfile }: { profileId: string; isOwnProfile: boolean }) {
  const [passes, setPasses] = useState<Array<{
    id: string;
    collection_id: string;
    collection_name: string;
    soulbound: boolean;
    minted_at: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const { supabase: sb } = { supabase: null } as unknown as { supabase: null };
  void sb; // supabase client is imported at module level

  useEffect(() => {
    import('../lib/supabase').then(({ supabase: client, isSupabaseConfigured }) => {
      if (!isSupabaseConfigured) { setLoading(false); return; }
      client
        .from('nft_tokens')
        .select('id, collection_id, soulbound, minted_at, nft_collections(name)')
        .eq('holder_profile', profileId)
        .order('minted_at', { ascending: false })
        .limit(50)
        .then(({ data }) => {
          setPasses(
            (data ?? []).map((t: Record<string, unknown>) => ({
              id: t.id as string,
              collection_id: t.collection_id as string,
              collection_name: (t.nft_collections as { name?: string } | null)?.name ?? 'Unknown collection',
              soulbound: !!t.soulbound,
              minted_at: t.minted_at as string | null,
            }))
          );
        })
        .catch(() => setPasses([]))
        .finally(() => setLoading(false));
    });
  }, [profileId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="text-gray-400">Loading passes…</div>
      </div>
    );
  }

  if (passes.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🪙</div>
        <h3 className="text-xl font-semibold text-gray-400 mb-2">No NFT passes yet</h3>
        <p className="text-gray-500 text-sm">
          {isOwnProfile
            ? 'Claim a mix pass or gig proof to see them here.'
            : 'This artist has not claimed any passes yet.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-4">
        {passes.length} pass{passes.length !== 1 ? 'es' : ''}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {passes.map(p => (
          <div key={p.id} className="bg-gray-800 rounded-lg p-4">
            <div className="text-3xl mb-2">{p.soulbound ? '🔒' : '🪙'}</div>
            <div className="text-white text-sm font-medium truncate">{p.collection_name}</div>
            <div className="text-gray-400 text-xs mt-1">
              {p.soulbound ? 'Soulbound · ' : ''}
              {p.minted_at ? new Date(p.minted_at).toLocaleDateString() : 'Pending mint'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
