import { supabase } from './supabase'
import type { FeedMix, Mix, Comment, Profile, Notification, FeedCursor, TrendingCursor, FeedResult, TrendingResult, Playlist, PlaylistWithMixes, ActivityEvent, RecommendedDJ } from './types'

// Storage bucket names
export const AUDIO_BUCKET = 'mix-audio'
export const ARTWORK_BUCKET = 'mix-artwork'
export const WAVEFORM_BUCKET = 'mix-waveforms'

// --- Profiles ---

export async function getProfile(username: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()
  return data
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()
  return data
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(20)
  return data || []
}

// --- Mixes ---

export async function getFeed(userId: string, limit = 20, cursor?: FeedCursor): Promise<FeedResult> {
  const { data } = await supabase.rpc('get_feed_cursor', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null
  })
  const dt = data || []
  return {
    data: dt,
    cursor: dt.length === limit ? { created_at: dt[dt.length - 1].created_at, id: dt[dt.length - 1].id } : null
  }
}

export async function getTrending(limit = 20, cursor?: TrendingCursor): Promise<TrendingResult> {
  const { data } = await supabase.rpc('get_trending_cursor', {
    p_limit: limit,
    p_cursor_score: cursor?.score ?? null,
    p_cursor_id: cursor?.id ?? null
  })
  const dt = data || []
  return {
    data: dt,
    cursor: dt.length === limit ? { score: dt[dt.length - 1].score ?? 0, id: dt[dt.length - 1].id } : null
  }
}

export async function getRecentMixes(limit = 20, cursor?: FeedCursor): Promise<FeedResult> {
  const { data } = await supabase.rpc('get_latest_cursor', {
    p_limit: limit,
    p_cursor_created_at: cursor?.created_at ?? null,
    p_cursor_id: cursor?.id ?? null
  })
  const dt = data || []
  return {
    data: dt,
    cursor: dt.length === limit ? { created_at: dt[dt.length - 1].created_at, id: dt[dt.length - 1].id } : null
  }
}

export async function getMixesByDj(djId: string): Promise<Mix[]> {
  const { data } = await supabase
    .from('mixes')
    .select('*')
    .eq('dj_id', djId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function getMix(id: string): Promise<Mix | null> {
  const { data, error } = await supabase
    .from('mixes')
    .select('*, profiles!mixes_dj_id_fkey(*), genres(name)')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return {
    ...data,
    dj: data.profiles,
    genre_name: data.genres?.name
  }
}

export async function createMix(mix: Partial<Mix>): Promise<Mix | null> {
  const { data } = await supabase
    .from('mixes')
    .insert(mix)
    .select()
    .single()
  return data
}

export async function updateMix(id: string, updates: Partial<Mix>): Promise<void> {
  await supabase.from('mixes').update(updates).eq('id', id)
}

export async function deleteMix(id: string): Promise<void> {
  await supabase.from('mixes').delete().eq('id', id)
}

export async function incrementPlayCount(mixId: string, userId?: string): Promise<void> {
  await supabase.rpc('increment_play_count', { p_mix_id: mixId })
  if (userId) {
    await supabase.from('play_history').insert({ mix_id: mixId, user_id: userId })
  } else {
    await supabase.from('play_history').insert({ mix_id: mixId })
  }
}

// --- Social ---

export async function follow(followerId: string, followingId: string) {
  return supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
}

export async function unfollow(followerId: string, followingId: string) {
  return supabase.from('follows').delete().match({ follower_id: followerId, following_id: followingId })
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('*')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return !!data
}

export async function getFollowersCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', userId)
  return count || 0
}

export async function getFollowingCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', userId)
  return count || 0
}

export async function like(userId: string, mixId: string) {
  return supabase.from('likes').insert({ user_id: userId, mix_id: mixId })
}

export async function unlike(userId: string, mixId: string) {
  return supabase.from('likes').delete().match({ user_id: userId, mix_id: mixId })
}

export async function hasLiked(userId: string, mixId: string): Promise<boolean> {
  const { data } = await supabase
    .from('likes')
    .select('*')
    .eq('user_id', userId)
    .eq('mix_id', mixId)
    .maybeSingle()
  return !!data
}

// --- Comments ---

interface ThreadedCommentRow {
  id: string
  user_id: string
  mix_id: string
  parent_id: string | null
  body: string
  created_at: string
  updated_at: string
  user_username: string
  user_display_name: string | null
  user_avatar_url: string | null
  user_verified: boolean
  replies: Array<{
    id: string
    user_id: string
    mix_id: string
    parent_id: string
    body: string
    created_at: string
    updated_at: string
    user: {
      id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      verified: boolean
    }
  }>
}

export async function getComments(mixId: string, limit = 50, offset = 0): Promise<Comment[]> {
  const { data, error } = await supabase.rpc('get_mix_comments', {
    p_mix_id: mixId,
    p_limit: limit,
    p_offset: offset,
  })
  if (error || !data) return []

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
  }))
}

export async function createComment(comment: Partial<Comment>): Promise<Comment | null> {
  const { data } = await supabase
    .from('comments')
    .insert(comment)
    .select()
    .single()
  return data
}

export async function searchMixes(query: string): Promise<FeedMix[]> {
  const { data } = await supabase
    .from('mixes')
    .select('*, profiles!mixes_dj_id_fkey(id, username, display_name, avatar_url), genres(name)')
    .eq('published', true)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20)
  return (data || []).map(formatFeedMix)
}

// --- Reposts ---

// --- Discovery / Recommendations ---

export async function getFansAlsoLiked(mixId: string, limit = 5): Promise<FeedMix[]> {
  const { data } = await supabase.rpc('get_fans_also_liked', {
    p_mix_id: mixId,
    p_limit: limit
  })
  return data || []
}

export async function getDiscovery(userId: string, limit = 20, cursor?: TrendingCursor): Promise<TrendingResult> {
  const { data } = await supabase.rpc('get_discovery', {
    p_user_id: userId,
    p_limit: limit,
    p_cursor_score: cursor?.score ?? null
  })
  const dt = data || []
  return {
    data: dt,
    cursor: dt.length === limit ? { score: dt[dt.length - 1].score ?? 0, id: dt[dt.length - 1].id } : null
  }
}

// --- Reposts ---

export async function repost(userId: string, mixId: string, djId: string) {
  // Idempotent — unique partial index (actor_id, mix_id) WHERE type='repost'
  // prevents duplicates; we just swallow the conflict.
  const { error } = await supabase.from('feed_events').insert({
    actor_id: userId,
    type: 'repost',
    mix_id: mixId,
    target_id: djId,
  })
  if (error && error.code !== '23505') throw error
}

export async function unrepost(mixId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('unrepost', { p_mix_id: mixId })
  if (error) throw error
  return data === true
}

export async function hasReposted(userId: string, mixId: string): Promise<boolean> {
  const { data } = await supabase
    .from('feed_events')
    .select('id')
    .eq('actor_id', userId)
    .eq('mix_id', mixId)
    .eq('type', 'repost')
    .maybeSingle()
  return !!data
}

// --- Notifications ---

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*, profiles!notifications_actor_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  return (data || []).map(n => ({
    ...n,
    actor: n.profiles as unknown as Profile
  })) as Notification[]
}

export async function markNotificationsRead(userId: string) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false)
}

// --- Upload ---

export async function uploadAudio(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `mixes/${crypto.randomUUID()}.${ext}`
  const { data } = await supabase.storage.from(AUDIO_BUCKET).upload(path, file)
  if (!data) return null
  const { data: { publicUrl } } = supabase.storage.from(AUDIO_BUCKET).getPublicUrl(path)
  return publicUrl
}

export async function uploadArtwork(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `artwork/${crypto.randomUUID()}.${ext}`
  const { data } = await supabase.storage.from(ARTWORK_BUCKET).upload(path, file)
  if (!data) return null
  const { data: { publicUrl } } = supabase.storage.from(ARTWORK_BUCKET).getPublicUrl(path)
  return publicUrl
}

// --- Playlists ---

export async function createPlaylist(title: string, ownerId: string): Promise<Playlist | null> {
  const { data } = await supabase
    .from('playlists')
    .insert({ title, owner_id: ownerId })
    .select()
    .single()
  return data
}

export async function getPlaylistWithMixes(id: string): Promise<PlaylistWithMixes | null> {
  const { data } = await supabase.rpc('get_playlist_with_mixes', { p_playlist_id: id })
  if (!data || data.length === 0) return null
  const first = data[0] as Record<string, unknown>
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
      }))
  }
  return playlist
}

export async function getPlaylistsByUser(userId: string): Promise<Playlist[]> {
  const { data } = await supabase.rpc('get_playlists_by_user', { p_user_id: userId })
  return data || []
}

export async function updatePlaylist(id: string, updates: Partial<Playlist>): Promise<void> {
  await supabase.from('playlists').update(updates).eq('id', id)
}

export async function deletePlaylist(id: string): Promise<void> {
  await supabase.from('playlists').delete().eq('id', id)
}

export async function addMixToPlaylist(playlistId: string, mixId: string): Promise<void> {
  await supabase.rpc('add_mix_to_playlist', { p_playlist_id: playlistId, p_mix_id: mixId })
}

export async function removeMixFromPlaylist(playlistId: string, mixId: string): Promise<void> {
  await supabase.from('playlist_mixes').delete().match({ playlist_id: playlistId, mix_id: mixId })
}

export async function isMixInPlaylist(playlistId: string, mixId: string): Promise<boolean> {
  const { data } = await supabase
    .from('playlist_mixes')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('mix_id', mixId)
    .maybeSingle()
  return !!data
}

// --- Blocks ---

export async function blockUser(blockerId: string, blockedId: string) {
  return supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId })
}

export async function unblockUser(blockerId: string, blockedId: string) {
  return supabase.from('user_blocks').delete().match({ blocker_id: blockerId, blocked_id: blockedId })
}

export async function isBlocked(viewerId: string, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', targetId)
    .eq('blocked_id', viewerId)
    .maybeSingle()
  return !!data
}

export async function hasBlocked(blockerId: string, targetId: string): Promise<boolean> {
  const { data } = await supabase
    .from('user_blocks')
    .select('*')
    .eq('blocker_id', blockerId)
    .eq('blocked_id', targetId)
    .maybeSingle()
  return !!data
}

// --- Activity / Recommendations ---

export async function getUserActivity(userId: string): Promise<ActivityEvent[]> {
  const { data } = await supabase.rpc('get_user_activity', { p_user_id: userId })
  return data || []
}

export async function getRecommendedDJs(userId: string): Promise<RecommendedDJ[]> {
  const { data } = await supabase.rpc('get_recommended_djs', { p_user_id: userId })
  return data || []
}

// --- Helpers ---

function formatFeedMix(m: Record<string, unknown>): FeedMix {
  const profile = (m as { profiles: Profile }).profiles
  const genre = (m as { genres: { name: string } | null }).genres
  return {
    ...m as unknown as FeedMix,
    dj_id: profile?.id || '',
    dj_username: profile?.username || '',
    dj_display_name: profile?.display_name || '',
    dj_avatar_url: profile?.avatar_url || '',
    genre_name: genre?.name || null
  }
}


