import { isSupabaseConfigured, supabase } from './supabase';

/** Internal helper: fire-and-forget cache invalidation via server API (fail-open) */
function invalidateCache(payload: { userId?: string; mixId?: string }): void {
  if (typeof window === 'undefined') return;
  fetch('/api/cache/invalidate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {
    /* fail-open */
  });
}

/** Pre-check rate limit for a social action before calling Supabase directly */
async function checkRateLimit(action: string, userId: string): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  try {
    const res = await fetch(`/api/social/rate-limit?action=${action}&userId=${userId}`);
    const data = await res.json();
    return data.allowed !== false;
  } catch {
    return true; // fail-open
  }
}
import type {
  ActivityEvent,
  AISuggestion,
  AISuggestionStatus,
  AnalyticsEventType,
  ArtistGoals,
  Buzz,
  Conversation,
  ConversationMember,
  ConversationSummary,
  DirectMessage,
  MythicQuest,
  QuestWithMilestones,
  BuzzFeedResult,
  Comment,
  CreatorTask,
  FeedBuzz,
  FeedCursor,
  FeedMix,
  FeedResult,
  Mix,
  MixedFeedResult,
  Notification,
  Opportunity,
  OpportunitySave,
  OpportunitySaveStatus,
  Playlist,
  PlaylistWithMixes,
  Profile,
  ProfileAnalytics,
  RecommendedDJ,
  TrendingCursor,
  TrendingResult,
  VerificationBadge,
  VerificationBadgeType,
  VerificationRequest,
} from './types';

// Storage bucket names
export const AUDIO_BUCKET = 'mix-audio';
export const ARTWORK_BUCKET = 'mix-artwork';
export const WAVEFORM_BUCKET = 'mix-waveforms';
export const AVATAR_BUCKET = 'profile-avatars';
export const BANNER_BUCKET = 'profile-banners';
export const BUZZ_MEDIA_BUCKET = 'buzz-media';

function emptyFeedResult(): FeedResult {
  return { data: [], cursor: null };
}

function emptyTrendingResult(): TrendingResult {
  return { data: [], cursor: null };
}

// --- Profiles ---

export async function getProfile(username: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.from('profiles').select('*').eq('username', username).single();
  return data;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
  return data;
}

export async function getProfileBadges(profileId: string): Promise<VerificationBadge[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('verification_badges')
    .select('*')
    .eq('profile_id', profileId)
    .order('granted_at', { ascending: false });
  return data || [];
}

export async function getMyVerificationRequest(
  profileId: string
): Promise<VerificationRequest | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function createVerificationRequest(input: {
  profileId: string;
  djName: string;
  links: Record<string, string>;
  proof: string;
  requestedBadge: VerificationBadgeType;
}): Promise<VerificationRequest | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('verification_requests')
    .insert({
      profile_id: input.profileId,
      dj_name: input.djName,
      links: input.links,
      proof: input.proof,
      requested_badge: input.requestedBadge,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listVerificationRequests(): Promise<VerificationRequest[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('verification_requests')
    .select('*, profiles!verification_requests_profile_id_fkey(*)')
    .order('created_at', { ascending: false });
  return (data || []).map(row => ({
    ...row,
    profile: (row as unknown as { profiles: Profile }).profiles,
  })) as VerificationRequest[];
}

export async function reviewVerificationRequest(input: {
  requestId: string;
  reviewerId: string;
  status: 'approved' | 'rejected';
  reason?: string;
  badgeType?: VerificationBadgeType;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc('review_verification_request', {
    p_request_id: input.requestId,
    p_reviewer_id: input.reviewerId,
    p_status: input.status,
    p_reason: input.reason || null,
    p_badge_type: input.badgeType || null,
  });
  if (error) throw error;
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(20);
  return data || [];
}

// --- Mixes ---

export async function getFeed(
  userId: string,
  limit = 20,
  cursor?: FeedCursor
): Promise<FeedResult> {
  if (!isSupabaseConfigured) return emptyFeedResult();
  const { data } = await supabase.rpc('get_feed_cursor', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  });
  const dt = data || [];
  return {
    data: dt,
    cursor:
      dt.length === limit
        ? { created_at: dt[dt.length - 1].created_at, id: dt[dt.length - 1].id }
        : null,
  };
}

export async function getTrending(
  limit = 20,
  cursor?: TrendingCursor,
  _genre?: string
): Promise<TrendingResult> {
  if (!isSupabaseConfigured) return emptyTrendingResult();

  const { data } = await supabase.rpc('get_trending_cursor', {
    p_limit: limit,
    p_cursor_score: cursor?.score ?? null,
    p_cursor_id: cursor?.id ?? null,
  });
  const dt = data || [];
  const last = dt[dt.length - 1];
  return {
    data: dt,
    cursor: dt.length === limit && last ? { score: last.score ?? 0, id: last.id } : null,
  };
}

export async function getRecentMixes(limit = 20, cursor?: FeedCursor): Promise<FeedResult> {
  if (!isSupabaseConfigured) return emptyFeedResult();
  const { data } = await supabase.rpc('get_latest_cursor', {
    p_limit: limit,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null,
  });
  const dt = data || [];
  return {
    data: dt,
    cursor:
      dt.length === limit
        ? { created_at: dt[dt.length - 1].created_at, id: dt[dt.length - 1].id }
        : null,
  };
}

export async function getMixesByDj(djId: string): Promise<Mix[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('mixes')
    .select('*')
    .eq('dj_id', djId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getMix(id: string): Promise<Mix | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('mixes')
    .select('*, profiles!mixes_dj_id_fkey(*), genres(name)')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return {
    ...data,
    dj: data.profiles,
    genre_name: data.genres?.name,
  };
}

export async function createMix(mix: Partial<Mix>): Promise<Mix | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.from('mixes').insert(mix).select().single();
  if (data?.id && typeof window !== 'undefined') {
    fetch('/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: 'mix', entity_id: data.id }),
    }).catch(() => {});
  }
  return data;
}

export async function updateMix(id: string, updates: Partial<Mix>): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('mixes').update(updates).eq('id', id);
}

export async function deleteMix(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('mixes').delete().eq('id', id);
  invalidateCache({ mixId: id });
}

export async function incrementPlayCount(mixId: string, userId?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.rpc('increment_play_count', { p_mix_id: mixId });
  if (userId) {
    await supabase.from('play_history').insert({ mix_id: mixId, user_id: userId });
  } else {
    await supabase.from('play_history').insert({ mix_id: mixId });
  }
}

export async function trackAnalyticsEvent(input: {
  profileId: string;
  eventType: AnalyticsEventType;
  actorId?: string | null;
  mixId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('analytics_events').insert({
    profile_id: input.profileId,
    actor_id: input.actorId || null,
    mix_id: input.mixId || null,
    event_type: input.eventType,
    metadata: input.metadata || {},
  });
}

// --- Social ---

export async function follow(followerId: string, followingId: string) {
  if (!isSupabaseConfigured) return { error: null };
  if (!(await checkRateLimit('follow', followerId)))
    return { error: { message: 'Rate limit exceeded' } };
  const result = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (!result.error) {
    invalidateCache({ userId: followerId });
    invalidateCache({ userId: followingId });
  }
  return result;
}

export async function unfollow(followerId: string, followingId: string) {
  if (!isSupabaseConfigured) return { error: null };
  if (!(await checkRateLimit('unfollow', followerId)))
    return { error: { message: 'Rate limit exceeded' } };
  const result = await supabase
    .from('follows')
    .delete()
    .match({ follower_id: followerId, following_id: followingId });
  if (!result.error) {
    invalidateCache({ userId: followerId });
    invalidateCache({ userId: followingId });
  }
  return result;
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return !!data;
}

export async function getFollowersCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId);
  return count || 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId);
  return count || 0;
}

export async function like(userId: string, mixId: string) {
  if (!isSupabaseConfigured) return { error: null };
  if (!(await checkRateLimit('like', userId))) return { error: { message: 'Rate limit exceeded' } };
  const { data, error } = await supabase
    .from('likes')
    .insert({ user_id: userId, mix_id: mixId })
    .select()
    .single();
  return { data, error };
}

export async function unlike(userId: string, mixId: string) {
  if (!isSupabaseConfigured) return { error: null };
  return supabase.from('likes').delete().match({ user_id: userId, mix_id: mixId });
}

export async function hasLiked(userId: string, mixId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('likes')
    .select('*')
    .eq('user_id', userId)
    .eq('mix_id', mixId)
    .maybeSingle();
  return !!data;
}

// --- Comments ---

interface ThreadedCommentRow {
  id: string;
  user_id: string;
  mix_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  user_username: string;
  user_display_name: string | null;
  user_avatar_url: string | null;
  user_verified: boolean;
  replies: Array<{
    id: string;
    user_id: string;
    mix_id: string;
    parent_id: string;
    body: string;
    created_at: string;
    updated_at: string;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      verified: boolean;
    };
  }>;
}

export async function getComments(mixId: string, limit = 50, offset = 0): Promise<Comment[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc('get_mix_comments', {
    p_mix_id: mixId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error || !data) return [];

  return (data as ThreadedCommentRow[]).map(row => ({
    id: row.id,
    user_id: row.user_id,
    mix_id: row.mix_id,
    parent_id: row.parent_id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
    user: {
      id: row.user_id,
      username: row.user_username,
      display_name: row.user_display_name,
      avatar_url: row.user_avatar_url,
      verified: row.user_verified,
      banner_url: null,
      bio: null,
      location: null,
      website: null,
      genres: [],
      social_links: {},
      is_dj: true,
      created_at: '',
      updated_at: '',
    },
    replies: row.replies.map(r => ({
      id: r.id,
      user_id: r.user_id,
      mix_id: r.mix_id,
      parent_id: r.parent_id,
      body: r.body,
      created_at: r.created_at,
      updated_at: r.updated_at,
      user: {
        id: r.user.id,
        username: r.user.username,
        display_name: r.user.display_name,
        avatar_url: r.user.avatar_url,
        verified: r.user.verified,
        banner_url: null,
        bio: null,
        location: null,
        website: null,
        genres: [],
        social_links: {},
        is_dj: true,
        created_at: '',
        updated_at: '',
      },
    })),
  }));
}

export async function createComment(comment: Partial<Comment>): Promise<Comment | null> {
  if (!isSupabaseConfigured) return null;
  if (comment.user_id && !(await checkRateLimit('comment', comment.user_id))) return null;
  const { data, error } = await supabase.from('comments').insert(comment).select().single();
  return error ? null : data;
}

export async function searchMixes(query: string): Promise<FeedMix[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('mixes')
    .select('*, profiles!mixes_dj_id_fkey(id, username, display_name, avatar_url), genres(name)')
    .eq('published', true)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data || []).map(formatFeedMix);
}

// --- Reposts ---

// --- Discovery / Recommendations ---

export async function getFansAlsoLiked(mixId: string, limit = 5): Promise<FeedMix[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.rpc('get_fans_also_liked', {
    p_mix_id: mixId,
    p_limit: limit,
  });
  return data || [];
}

export async function getDiscovery(
  userId: string,
  limit = 20,
  cursor?: TrendingCursor
): Promise<TrendingResult> {
  if (!isSupabaseConfigured) return emptyTrendingResult();
  const { data } = await supabase.rpc('get_discovery', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor_score: cursor?.score ?? null,
  });
  const dt = data || [];
  return {
    data: dt,
    cursor:
      dt.length === limit
        ? { score: dt[dt.length - 1].score ?? 0, id: dt[dt.length - 1].id }
        : null,
  };
}

// --- Reposts ---

export async function repost(userId: string, mixId: string, djId: string) {
  if (!isSupabaseConfigured) return;
  // Idempotent — unique partial index (actor_id, mix_id) WHERE type='repost'
  // prevents duplicates; we just swallow the conflict.
  const { error } = await supabase.from('feed_events').insert({
    actor_id: userId,
    type: 'repost',
    mix_id: mixId,
    target_id: djId,
  });
  if (error && error.code !== '23505') throw error;
}

export async function unrepost(mixId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data, error } = await supabase.rpc('unrepost', { p_mix_id: mixId });
  if (error) throw error;
  return data === true;
}

export async function hasReposted(userId: string, mixId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('feed_events')
    .select('id')
    .eq('actor_id', userId)
    .eq('mix_id', mixId)
    .eq('type', 'repost')
    .maybeSingle();
  return !!data;
}

// --- Notifications ---

export async function getNotifications(userId: string): Promise<Notification[]> {
  if (!isSupabaseConfigured || typeof window === 'undefined') return [];
  try {
    const res = await fetch(`/api/notifications?userId=${userId}`);
    if (!res.ok) throw new Error('Failed to fetch notifications');
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

export async function markNotificationsRead(userId: string) {
  if (!isSupabaseConfigured || typeof window === 'undefined') return;
  try {
    const res = await fetch(`/api/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error('Failed to mark notifications as read');
  } catch (error) {
    console.error('Failed to mark notifications as read:', error);
  }
}

// --- Upload ---

import { uploadAudioWithCDN, uploadArtworkWithCDN, uploadBuzzMediaWithCDN } from './cdnUpload';

export async function uploadAudio(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  // Enhanced upload with CDN support
  const result = await uploadAudioWithCDN(file, {
    enableCDN: process.env.NEXT_PUBLIC_CDN_ENABLED === 'true',
    optimization: {
      format: 'mp3',
      quality: 128,
    },
  });

  return result?.url || null;
}

export async function uploadArtwork(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  // Enhanced upload with CDN support
  const result = await uploadArtworkWithCDN(file, {
    enableCDN: process.env.NEXT_PUBLIC_CDN_ENABLED === 'true',
    optimization: {
      format: 'webp',
      quality: 85,
    },
  });

  return result?.url || null;
}

// --- Playlists ---

export async function createPlaylist(title: string, ownerId: string): Promise<Playlist | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from('playlists')
    .insert({ title, owner_id: ownerId })
    .select()
    .single();
  return data;
}

export async function getPlaylistWithMixes(id: string): Promise<PlaylistWithMixes | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.rpc('get_playlist_with_mixes', { p_playlist_id: id });
  if (!data || data.length === 0) return null;
  const first = data[0] as Record<string, unknown>;
  const playlist: PlaylistWithMixes = {
    id: first.id as string,
    owner_id: first.owner_id as string,
    title: first.title as string,
    description: first.description as string | null,
    artwork_url: first.artwork_url as string | null,
    is_public: first.is_public as boolean,
    mix_count: first.mix_count as number,
    created_at: first.created_at as string,
    updated_at: first.updated_at as string,
    owner_username: first.owner_username as string,
    owner_display_name: first.owner_display_name as string,
    owner_avatar_url: first.owner_avatar_url as string,
    mixes: data
      .filter((r: Record<string, unknown>) => r.mix_id)
      .map((r: Record<string, unknown>) => ({
        id: r.mix_id as string,
        title: r.mix_title as string,
        artwork_url: r.mix_artwork_url as string | null,
        audio_url: r.mix_audio_url as string,
        duration_seconds: r.mix_duration_seconds as number | null,
        play_count: r.mix_play_count as number,
        like_count: r.mix_like_count as number,
        genre_name: r.mix_genre_name as string | null,
        tags: r.mix_tags as string[],
        waveform_url: r.mix_waveform_url as string | null,
        audio_quality: r.mix_audio_quality as string | null,
        created_at: r.mix_created_at as string,
        position: r.mix_position as number,
        dj_id: r.dj_id as string,
        dj_username: r.dj_username as string,
        dj_display_name: r.dj_display_name as string,
        dj_avatar_url: r.dj_avatar_url as string,
      })),
  };
  return playlist;
}

export async function getPlaylistsByUser(userId: string): Promise<Playlist[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.rpc('get_playlists_by_user', { p_user_id: userId });
  return data || [];
}

export async function updatePlaylist(id: string, updates: Partial<Playlist>): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('playlists').update(updates).eq('id', id);
}

export async function deletePlaylist(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('playlists').delete().eq('id', id);
}

export async function addMixToPlaylist(playlistId: string, mixId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.rpc('add_mix_to_playlist', { p_playlist_id: playlistId, p_mix_id: mixId });
}

export async function removeMixFromPlaylist(playlistId: string, mixId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('playlist_mixes').delete().match({ playlist_id: playlistId, mix_id: mixId });
}

export async function isMixInPlaylist(playlistId: string, mixId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('playlist_mixes')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('mix_id', mixId)
    .maybeSingle();
  return !!data;
}

// --- Blocks ---

export async function blockUser(blockerId: string, blockedId: string) {
  if (!isSupabaseConfigured) return { error: null };
  return supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  if (!isSupabaseConfigured) return { error: null };
  return supabase
    .from('user_blocks')
    .delete()
    .match({ blocker_id: blockerId, blocked_id: blockedId });
}

export async function isBlocked(viewerId: string, targetId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', targetId)
    .eq('blocked_id', viewerId)
    .maybeSingle();
  return !!data;
}

export async function hasBlocked(blockerId: string, targetId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', targetId)
    .maybeSingle();
  return !!data;
}

// --- Messaging ---

export async function getOrCreateDm(otherProfileId: string): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_other: otherProfileId });
  if (error) {
    console.error('getOrCreateDm error:', error.message);
    return null;
  }
  return data as string;
}

export async function listConversations(): Promise<ConversationSummary[]> {
  if (!isSupabaseConfigured) return [];
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? '';
  if (!userId) return [];

  const { data, error } = await supabase
    .from('conversation_members')
    .select(`
      conversation_id,
      last_read_at,
      conversation:conversations!inner(*),
      member_profiles:conversation_members(profile_id, profile:profiles(*))
    `)
    .eq('profile_id', userId);

  if (error || !data) {
    console.error('listConversations error:', error?.message);
    return [];
  }

  const summaries: ConversationSummary[] = [];

  for (const row of data as any[]) {
    const conversation: Conversation = row.conversation;
    const members: { profile_id: string; profile: Profile }[] = row.member_profiles ?? [];
    const otherMember = members.find(m => m.profile_id !== userId)?.profile;
    if (!otherMember) continue;

    const { data: msgData } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastMessage: DirectMessage | null = msgData;
    const unread = !!lastMessage && lastMessage.sender_id !== userId && new Date(lastMessage.created_at) > new Date(row.last_read_at);

    summaries.push({ conversation, otherMember, lastMessage, unread });
  }

  return summaries.sort((a, b) => {
    const aTime = a.lastMessage?.created_at ?? a.conversation.created_at;
    const bTime = b.lastMessage?.created_at ?? b.conversation.created_at;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });
}

export async function getMessages(
  conversationId: string,
  beforeCursor?: string,
  limit = 50
): Promise<{ messages: DirectMessage[]; nextCursor?: string }> {
  if (!isSupabaseConfigured) return { messages: [] };
  let query = supabase
    .from('messages')
    .select('*, sender:profiles(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (beforeCursor) {
    query = query.lt('created_at', beforeCursor);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error('getMessages error:', error?.message);
    return { messages: [] };
  }

  const messages = (data as any[]).reverse();
  const nextCursor = data.length === limit ? (data[data.length - 1] as DirectMessage).created_at : undefined;

  return { messages, nextCursor };
}

export async function sendMessage(payload: {
  conversationId: string;
  id: string;
  body: string;
  attachment?: Record<string, unknown>;
}): Promise<DirectMessage | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('messages')
    .insert({
      id: payload.id,
      conversation_id: payload.conversationId,
      body: payload.body,
      attachment: payload.attachment ?? null,
    })
    .select('*, sender:profiles(id, username, display_name, avatar_url)')
    .single();

  if (error) {
    console.error('sendMessage error:', error.message);
    return null;
  }
  return data as DirectMessage;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('conversation_members')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('profile_id', user.id);
}

// --- Activity / Recommendations ---

export async function getUserActivity(userId: string): Promise<ActivityEvent[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.rpc('get_user_activity', { p_user_id: userId });
  return data || [];
}

export async function getProfileAnalytics(
  profileId: string,
  mixes?: Mix[]
): Promise<ProfileAnalytics> {
  const profileMixes = mixes ?? (await getMixesByDj(profileId));
  const [followers, following] = await Promise.all([
    getFollowersCount(profileId),
    getFollowingCount(profileId),
  ]);

  const totalPlays = profileMixes.reduce((sum, mix) => sum + (mix.play_count || 0), 0);
  const totalLikes = profileMixes.reduce((sum, mix) => sum + (mix.like_count || 0), 0);
  const totalComments = profileMixes.reduce((sum, mix) => sum + (mix.comment_count || 0), 0);
  const sortedMixes = [...profileMixes]
    .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
    .slice(0, 5);
  const genreDistribution = Array.from(
    profileMixes.reduce((map, mix) => {
      const name = mix.genre_name || 'Uncategorized';
      map.set(name, (map.get(name) || 0) + 1);
      return map;
    }, new Map<string, number>())
  ).map(([name, count]) => ({ name, count }));

  const createdTimes = profileMixes
    .map(mix => new Date(mix.created_at).getTime())
    .filter(time => Number.isFinite(time))
    .sort((a, b) => a - b);
  const uploadFrequencyDays =
    createdTimes.length > 1
      ? Math.round(
          (createdTimes[createdTimes.length - 1]! - createdTimes[0]!) /
            (createdTimes.length - 1) /
            86400000
        )
      : null;

  let weeklyEvents: Array<{ label: string; count: number }> = [];
  if (isSupabaseConfigured) {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 42).toISOString();
    const { data } = await supabase
      .from('analytics_events')
      .select('created_at')
      .eq('profile_id', profileId)
      .gte('created_at', since);
    const buckets = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(Date.now() - i * 7 * 86400000);
      const label = `${date.getMonth() + 1}/${date.getDate()}`;
      buckets.set(label, 0);
    }
    (data || []).forEach(event => {
      const date = new Date(event.created_at);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
      buckets.set(label, (buckets.get(label) || 0) + 1);
    });
    weeklyEvents = Array.from(buckets, ([label, count]) => ({ label, count })).slice(-6);
  }

  if (weeklyEvents.length === 0) {
    weeklyEvents = [5, 4, 3, 2, 1, 0].map(index => {
      const date = new Date(Date.now() - index * 7 * 86400000);
      return { label: `${date.getMonth() + 1}/${date.getDate()}`, count: 0 };
    });
  }

  return {
    totalPlays,
    totalLikes,
    totalComments,
    totalMixes: profileMixes.length,
    followers,
    following,
    averagePlaysPerMix: profileMixes.length ? Math.round(totalPlays / profileMixes.length) : 0,
    likeToPlayRatio: totalPlays ? Number(((totalLikes / totalPlays) * 100).toFixed(1)) : 0,
    followerEngagementRate: followers
      ? Number((((totalLikes + totalComments) / followers) * 100).toFixed(1))
      : 0,
    uploadFrequencyDays,
    topMixes: sortedMixes,
    genreDistribution,
    weeklyEvents,
  };
}

export async function getRecommendedDJs(userId: string): Promise<RecommendedDJ[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.rpc('get_recommended_djs', { p_user_id: userId });
  return data || [];
}

// --- Discover Features ---

export async function getTrendingMixes(limit = 12): Promise<{ data: FeedMix[] }> {
  if (!isSupabaseConfigured) return { data: [] };
  const { data } = await supabase.rpc('get_trending_cursor', {
    p_limit: limit,
    p_cursor_score: null,
    p_cursor_id: null,
  });
  return { data: (data || []).map(formatFeedMix) };
}

export async function getTopDJs(limit = 8): Promise<{ data: Profile[] }> {
  if (!isSupabaseConfigured) return { data: [] };
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('followers_count', { ascending: false })
    .limit(limit);
  return { data: data || [] };
}

export async function getPopularGenres(
  limit = 12
): Promise<{ data: Array<{ id: string; name: string; count: number }> }> {
  if (!isSupabaseConfigured) return { data: [] };
  // This would need to be implemented as a PostgreSQL function
  // For now, return mock data
  const mockGenres = [
    { id: '1', name: 'House', count: 1247 },
    { id: '2', name: 'Techno', count: 892 },
    { id: '3', name: 'Deep House', count: 654 },
    { id: '4', name: 'Trance', count: 543 },
    { id: '5', name: 'Progressive', count: 432 },
    { id: '6', name: 'Minimal', count: 321 },
    { id: '7', name: 'Dubstep', count: 298 },
    { id: '8', name: 'Ambient', count: 234 },
    { id: '9', name: 'Drum & Bass', count: 187 },
    { id: '10', name: 'Tech House', count: 156 },
    { id: '11', name: 'Disco', count: 143 },
    { id: '12', name: 'Electronic', count: 132 },
  ];
  return { data: mockGenres.slice(0, limit) };
}

export async function getRecommendedMixes(userId: string): Promise<FeedMix[]> {
  void userId;
  if (!isSupabaseConfigured) return [];
  // This would need to be implemented as a PostgreSQL function
  // For now, return trending mixes as a fallback
  const res = await getTrendingMixes(10);
  return res.data;
}

export async function getTrendingGenres(
  limit = 10
): Promise<Array<{ id: string; name: string; count: number }>> {
  // This would need to be implemented as a PostgreSQL function
  // For now, return mock data
  const mockGenres = [
    { id: '1', name: 'House', count: 1247 },
    { id: '2', name: 'Techno', count: 892 },
    { id: '3', name: 'Deep House', count: 654 },
    { id: '4', name: 'Trance', count: 543 },
    { id: '5', name: 'Progressive', count: 432 },
    { id: '6', name: 'Minimal', count: 321 },
    { id: '7', name: 'Dubstep', count: 298 },
    { id: '8', name: 'Ambient', count: 234 },
    { id: '9', name: 'Drum & Bass', count: 187 },
    { id: '10', name: 'Tech House', count: 156 },
  ];
  return mockGenres.slice(0, limit);
}

// --- Landing-page stats ---

export interface HiveStats {
  mixes_total: number;
  voices_total: number;
  plays_total: number;
  live_now: number;
}

/**
 * Whole-platform aggregate counts for the landing-page stats strip.
 * Backed by the get_hive_stats() RPC in migration 023.
 */
export async function getHiveStats(): Promise<HiveStats> {
  const empty: HiveStats = { mixes_total: 0, voices_total: 0, plays_total: 0, live_now: 0 };
  if (!isSupabaseConfigured) return empty;

  const { data, error } = await supabase.rpc('get_hive_stats');
  if (error || !data) return empty;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    mixes_total: Number(row?.mixes_total ?? 0),
    voices_total: Number(row?.voices_total ?? 0),
    plays_total: Number(row?.plays_total ?? 0),
    live_now: Number(row?.live_now ?? 0),
  };
}

// --- Buzz ---

export async function uploadBuzzMedia(file: File): Promise<string | null> {
  if (!isSupabaseConfigured) return null;

  // Enhanced upload with CDN support
  const result = await uploadBuzzMediaWithCDN(file, 'image', {
    enableCDN: process.env.NEXT_PUBLIC_CDN_ENABLED === 'true',
    optimization: {
      format: 'webp',
      quality: 75,
    },
  });

  return result?.url || null;
}

export async function createBuzz(
  authorId: string,
  body: string,
  opts: {
    imageFile?: File | undefined;
    audioFile?: File | undefined;
    videoFile?: File | undefined;
    codeSnippet?: string | undefined;
    codeLanguage?: string | undefined;
    attachedMixId?: string | undefined;
  } = {}
): Promise<Buzz | null> {
  if (!isSupabaseConfigured) return null;
  if (!(await checkRateLimit('buzz', authorId))) return null;
  const [imageUrl, audioUrl, videoUrl] = await Promise.all([
    opts.imageFile ? uploadBuzzMedia(opts.imageFile) : Promise.resolve(null),
    opts.audioFile ? uploadBuzzMedia(opts.audioFile) : Promise.resolve(null),
    opts.videoFile ? uploadBuzzMedia(opts.videoFile) : Promise.resolve(null),
  ]);
  const { data, error } = await supabase
    .from('buzzes')
    .insert({
      author_id: authorId,
      body,
      image_url: imageUrl,
      audio_url: audioUrl,
      video_url: videoUrl,
      code_snippet: opts.codeSnippet || null,
      code_language: opts.codeLanguage || null,
      attached_mix_id: opts.attachedMixId || null,
    })
    .select()
    .single();
  if (error) throw error;
  invalidateCache({ userId: authorId });
  return data;
}

export async function deleteBuzz(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('buzzes').delete().eq('id', id);
}

export async function getBuzz(id: string): Promise<Buzz | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from('buzzes')
    .select('*, profiles!buzzes_author_id_fkey(*), mixes!buzzes_attached_mix_id_fkey(*)')
    .eq('id', id)
    .single();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as unknown as Buzz),
    author: row['profiles'] as Profile,
    attached_mix: (row['mixes'] as Mix) || null,
  };
}

export async function getUserBuzzes(
  userId: string,
  limit = 20,
  cursor?: FeedCursor
): Promise<BuzzFeedResult> {
  if (!isSupabaseConfigured) return { data: [], cursor: null };
  let q = supabase
    .from('buzzes')
    .select('*, profiles!buzzes_author_id_fkey(*)')
    .eq('author_id', userId)
    .is('parent_buzz_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }
  const { data } = await q;
  const rows = (data || []).map(r => ({
    ...(r as unknown as FeedBuzz),
    author: (r as Record<string, unknown>)['profiles'] as Profile,
  }));
  const lastRow = rows[rows.length - 1];
  return {
    data: rows,
    cursor:
      rows.length === limit && lastRow ? { created_at: lastRow.created_at, id: lastRow.id } : null,
  };
}

export async function getBuzzFeed(
  userId: string,
  limit = 20,
  cursor?: FeedCursor
): Promise<BuzzFeedResult> {
  if (!isSupabaseConfigured) return { data: [], cursor: null };
  let q = supabase
    .from('feed_events')
    .select('id, buzz_id, buzzes(*, profiles!buzzes_author_id_fkey(*))')
    .eq('target_id', userId)
    .eq('type', 'buzz')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }
  const { data } = await q;
  const rows = (data || [])
    .filter((r: Record<string, unknown>) => r['buzzes'])
    .map((r: Record<string, unknown>) => {
      const buzz = r['buzzes'] as Record<string, unknown>;
      return {
        ...(buzz as unknown as FeedBuzz),
        author: buzz['profiles'] as Profile,
        feed_event_id: r['id'] as string,
      };
    });
  const lastRow = rows[rows.length - 1];
  return {
    data: rows,
    cursor:
      rows.length === limit && lastRow ? { created_at: lastRow.created_at, id: lastRow.id } : null,
  };
}

export async function getLatestBuzzes(limit = 20, cursor?: FeedCursor): Promise<BuzzFeedResult> {
  if (!isSupabaseConfigured) return { data: [], cursor: null };
  let q = supabase
    .from('buzzes')
    .select('*, profiles!buzzes_author_id_fkey(*)')
    .is('parent_buzz_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (cursor) {
    q = q.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`
    );
  }
  const { data } = await q;
  const rows = (data || []).map(r => ({
    ...(r as unknown as FeedBuzz),
    author: (r as Record<string, unknown>)['profiles'] as Profile,
  }));
  const lastRow = rows[rows.length - 1];
  return {
    data: rows,
    cursor:
      rows.length === limit && lastRow ? { created_at: lastRow.created_at, id: lastRow.id } : null,
  };
}

export async function getMixedFollowingFeed(
  userId: string,
  limit = 20,
  mixCursor?: FeedCursor,
  buzzCursor?: FeedCursor
): Promise<MixedFeedResult> {
  // On the first page, also pull in the user's own buzzes.
  // After migration 032 the DB trigger handles self-fanout for new buzzes,
  // but existing buzzes have no feed_event row — the client-side merge keeps
  // the feed correct regardless of when the migration was applied.
  const isFirstPage = !mixCursor && !buzzCursor;
  const [mixResult, followingBuzzResult, ownBuzzResult] = await Promise.all([
    getFeed(userId, limit, mixCursor),
    getBuzzFeed(userId, limit, buzzCursor),
    isFirstPage
      ? getUserBuzzes(userId, limit)
      : Promise.resolve({ data: [], cursor: null } as BuzzFeedResult),
  ]);
  const seenBuzzIds = new Set(followingBuzzResult.data.map(b => b.id));
  const allBuzzes = [
    ...followingBuzzResult.data,
    ...ownBuzzResult.data.filter(b => !seenBuzzIds.has(b.id)),
  ];
  const mixes = mixResult.data.map(m => ({ type: 'mix' as const, data: m, _ts: m.created_at }));
  const buzzes = allBuzzes.map(b => ({ type: 'buzz' as const, data: b, _ts: b.created_at }));
  const merged = [...mixes, ...buzzes]
    .sort((a, b) => (a._ts < b._ts ? 1 : a._ts > b._ts ? -1 : 0))
    .slice(0, limit)
    .map(({ type, data }) => ({ type, data }) as MixedFeedResult['data'][number]);
  return { data: merged, mixCursor: mixResult.cursor, buzzCursor: followingBuzzResult.cursor };
}

export async function getLatestMixed(
  limit = 20,
  mixCursor?: FeedCursor,
  buzzCursor?: FeedCursor
): Promise<MixedFeedResult> {
  const [mixResult, buzzResult] = await Promise.all([
    getRecentMixes(limit, mixCursor),
    getLatestBuzzes(limit, buzzCursor),
  ]);
  const mixes = mixResult.data.map(m => ({ type: 'mix' as const, data: m, _ts: m.created_at }));
  const buzzes = buzzResult.data.map(b => ({ type: 'buzz' as const, data: b, _ts: b.created_at }));
  const merged = [...mixes, ...buzzes]
    .sort((a, b) => (a._ts < b._ts ? 1 : a._ts > b._ts ? -1 : 0))
    .slice(0, limit)
    .map(({ type, data }) => ({ type, data }) as MixedFeedResult['data'][number]);
  return { data: merged, mixCursor: mixResult.cursor, buzzCursor: buzzResult.cursor };
}

export async function getBuzzReplies(
  buzzId: string,
  limit = 20,
  cursor?: FeedCursor
): Promise<BuzzFeedResult> {
  if (!isSupabaseConfigured) return { data: [], cursor: null };
  let q = supabase
    .from('buzzes')
    .select('*, profiles!buzzes_author_id_fkey(*)')
    .eq('parent_buzz_id', buzzId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (cursor) {
    q = q.or(
      `created_at.gt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.gt.${cursor.id})`
    );
  }
  const { data } = await q;
  const rows = (data || []).map(r => ({
    ...(r as unknown as FeedBuzz),
    author: (r as Record<string, unknown>)['profiles'] as Profile,
  }));
  const lastRow = rows[rows.length - 1];
  return {
    data: rows,
    cursor:
      rows.length === limit && lastRow ? { created_at: lastRow.created_at, id: lastRow.id } : null,
  };
}

export async function replyToBuzz(
  authorId: string,
  parentId: string,
  body: string
): Promise<Buzz | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from('buzzes')
    .insert({ author_id: authorId, body, parent_buzz_id: parentId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function likeBuzz(userId: string, buzzId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('buzz_likes').insert({ user_id: userId, buzz_id: buzzId });
}

export async function unlikeBuzz(userId: string, buzzId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('buzz_likes').delete().match({ user_id: userId, buzz_id: buzzId });
}

export async function hasBuzzLiked(userId: string, buzzId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('buzz_likes')
    .select('user_id')
    .eq('user_id', userId)
    .eq('buzz_id', buzzId)
    .maybeSingle();
  return !!data;
}

export async function repostBuzz(userId: string, buzzId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('buzz_reposts').insert({ user_id: userId, buzz_id: buzzId });
}

export async function unrepostBuzz(userId: string, buzzId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('buzz_reposts').delete().match({ user_id: userId, buzz_id: buzzId });
}

export async function hasBuzzReposted(userId: string, buzzId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('buzz_reposts')
    .select('user_id')
    .eq('user_id', userId)
    .eq('buzz_id', buzzId)
    .maybeSingle();
  return !!data;
}

// ─── AI Key Management ────────────────────────────────────────────────────────

/** Returns true if the user has saved an OpenAI key (never returns the key itself). */
export async function hasUserAiKey(userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const { data } = await supabase
    .from('user_ai_key_status')
    .select('has_key')
    .eq('user_id', userId)
    .maybeSingle();
  return Boolean(data?.has_key);
}

/** Save (upsert) the user's own OpenAI API key. */
export async function saveUserAiKey(userId: string, apiKey: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from('user_ai_keys')
    .upsert({ user_id: userId, openai_api_key: apiKey }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Remove the user's stored OpenAI API key. */
export async function removeUserAiKey(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('user_ai_keys').delete().eq('user_id', userId);
}

// --- AI Infrastructure ---

export async function getAISuggestions(
  userId: string,
  status?: AISuggestionStatus
): Promise<AISuggestion[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase
    .from('ai_suggestions')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (status) q = q.eq('status', status);
  const { data } = await q;
  return (data ?? []) as AISuggestion[];
}

export async function getCreatorTasks(userId: string): Promise<CreatorTask[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase
    .from('creator_tasks')
    .select('*')
    .eq('owner_id', userId)
    .eq('status', 'open')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as CreatorTask[];
}

export async function getOpportunities(filters?: {
  city?: string;
  genre?: string;
  type?: string;
  limit?: number;
}): Promise<Opportunity[]> {
  if (!isSupabaseConfigured) return [];
  const params = new URLSearchParams();
  if (filters?.city) params.set('city', filters.city);
  if (filters?.genre) params.set('genre', filters.genre);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.limit) params.set('limit', String(filters.limit));
  const res = await fetch(`/api/opportunities?${params.toString()}`);
  if (!res.ok) return [];
  const json = (await res.json()) as { opportunities?: Opportunity[] };
  return json.opportunities ?? [];
}

export async function getOpportunitySaves(userId: string): Promise<OpportunitySave[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await supabase.from('opportunity_saves').select('*').eq('user_id', userId);
  return (data || []) as OpportunitySave[];
}

export async function upsertOpportunitySave(
  userId: string,
  opportunityId: string,
  status: OpportunitySaveStatus,
  draftText?: string
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from('opportunity_saves')
    .upsert(
      { user_id: userId, opportunity_id: opportunityId, status, draft_text: draftText ?? null },
      { onConflict: 'user_id,opportunity_id' }
    );
}

export async function getArtistGoals(userId: string): Promise<ArtistGoals | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase
    .from('artist_goals')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as ArtistGoals | null;
}

export async function upsertArtistGoals(
  userId: string,
  goals: Partial<Omit<ArtistGoals, 'user_id' | 'updated_at'>>
): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from('artist_goals')
    .upsert(
      { user_id: userId, ...goals, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
}

// --- Mythic Quest Functions (Phase 6) ---

export async function getActiveQuests(userId: string): Promise<MythicQuest[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('owner_id', userId)
    .in('status', ['active', 'paused'])
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('getActiveQuests error', error);
    return [];
  }
  return (data || []) as MythicQuest[];
}

export async function getQuestMilestoneCounts(
  questIds: string[]
): Promise<Record<string, { total: number; completed: number }>> {
  if (!isSupabaseConfigured || questIds.length === 0) return {};
  const { data, error } = await supabase
    .from('quest_milestones')
    .select('quest_id, status')
    .in('quest_id', questIds);
  if (error || !data) return {};
  const result: Record<string, { total: number; completed: number }> = {};
  for (const row of data as { quest_id: string; status: string }[]) {
    if (!result[row.quest_id]) result[row.quest_id] = { total: 0, completed: 0 };
    result[row.quest_id].total++;
    if (row.status === 'completed') result[row.quest_id].completed++;
  }
  return result;
}

export async function getQuestDetail(questId: string): Promise<QuestWithMilestones | null> {
  if (!isSupabaseConfigured) return null;

  const { data: quest, error: questErr } = await supabase
    .from('quests')
    .select('*')
    .eq('id', questId)
    .single();

  if (questErr || !quest) return null;

  const { data: milestones, error: mErr } = await supabase
    .from('quest_milestones')
    .select('*')
    .eq('quest_id', questId)
    .order('sort_order', { ascending: true });

  if (mErr) {
    console.error('getQuestDetail milestones error', mErr);
  }

  return {
    ...(quest as MythicQuest),
    milestones: (milestones || []) as any[],
  } as QuestWithMilestones;
}

export async function createQuest(input: {
  title: string;
  description?: string;
  target_scene_tags: string[];
  timeframe_days?: number;
}): Promise<MythicQuest | null> {
  if (!isSupabaseConfigured) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('quests')
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description ?? null,
      target_scene_tags: input.target_scene_tags,
      timeframe_days: input.timeframe_days ?? null,
      status: 'active',
      momentum: 30,
    })
    .select('*')
    .single();

  if (error) {
    console.error('createQuest error', error);
    return null;
  }
  return data as MythicQuest;
}

export async function completeMilestone(
  milestoneId: string,
  evidenceNodeIds: string[] = []
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    // 1. Update the milestone status
    const { error: updateErr } = await supabase
      .from('quest_milestones')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', milestoneId);

    if (updateErr) throw updateErr;

    // 2. Create evidence links if provided
    if (evidenceNodeIds.length > 0) {
      const evidenceRows = evidenceNodeIds.map(nodeId => ({
        milestone_id: milestoneId,
        node_id: nodeId,
      }));

      const { error: evidenceErr } = await supabase
        .from('quest_milestone_evidence')
        .insert(evidenceRows);

      if (evidenceErr) {
        console.warn('completeMilestone evidence insert warning:', evidenceErr);
        // Don't fail the whole operation if evidence linking has issues
      }
    }

    // 3. (Future) Enqueue a graph job to recalculate quest momentum if desired
    // await enqueue_mythic_graph_job({ milestone_id: milestoneId }, 'recalculate_quest_momentum');

    return true;
  } catch (e) {
    console.error('completeMilestone error', e);
    return false;
  }
}

// --- Helpers ---

function formatFeedMix(m: Record<string, unknown>): FeedMix {
  const profile = (m as { profiles: Profile }).profiles;
  const genre = (m as { genres: { name: string } | null }).genres;
  return {
    ...(m as unknown as FeedMix),
    dj_id: profile?.id || '',
    dj_username: profile?.username || '',
    dj_display_name: profile?.display_name || '',
    dj_avatar_url: profile?.avatar_url || '',
    genre_name: genre?.name || null,
  };
}
