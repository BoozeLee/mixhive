export interface Profile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  banner_url: string | null
  bio: string | null
  location: string | null
  website: string | null
  genres: string[]
  social_links: Record<string, string>
  is_dj: boolean
  verified: boolean
  is_admin?: boolean
  onboarding_complete?: boolean
  dj_equipment?: string[]
  dj_daw?: string[]
  dj_style?: string | null
  created_at: string
  updated_at: string
}

export type VerificationBadgeType = 'verified' | 'artist' | 'official'
export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected'
export type AnalyticsEventType = 'profile_view' | 'follow' | 'upload' | 'play' | 'like' | 'comment' | 'share' | 'verification'

export interface VerificationBadge {
  id: string
  profile_id: string
  badge_type: VerificationBadgeType
  label: string
  reason: string | null
  granted_by: string | null
  granted_at: string
  expires_at: string | null
}

export interface VerificationRequest {
  id: string
  profile_id: string
  dj_name: string
  links: Record<string, string>
  proof: string
  requested_badge: VerificationBadgeType
  status: VerificationRequestStatus
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  profile?: Profile
}

export interface AnalyticsEvent {
  id: string
  profile_id: string
  actor_id: string | null
  mix_id: string | null
  event_type: AnalyticsEventType
  metadata: Record<string, unknown>
  created_at: string
}

export interface ProfileAnalytics {
  totalPlays: number
  totalLikes: number
  totalComments: number
  totalMixes: number
  followers: number
  following: number
  averagePlaysPerMix: number
  likeToPlayRatio: number
  followerEngagementRate: number
  uploadFrequencyDays: number | null
  topMixes: Mix[]
  genreDistribution: Array<{ name: string; count: number }>
  weeklyEvents: Array<{ label: string; count: number }>
}

export interface Mix {
  id: string
  dj_id: string
  title: string
  description: string | null
  artwork_url: string | null
  audio_url: string
  duration_seconds: number | null
  genre_id: number | null
  tags: string[]
  tracklist: TrackItem[]
  platform_links: Record<string, string>
  is_explicit: boolean
  play_count: number
  like_count: number
  comment_count: number
  published: boolean
  status: 'processing' | 'ready' | 'error'
  waveform_url: string | null
  audio_quality: string | null
  created_at: string
  updated_at: string
  dj?: Profile
  genre_name?: string | null
  weekly_plays?: number
}

export interface TrackItem {
  artist: string
  title: string
  start_time?: number
}

export interface Comment {
  id: string
  user_id: string
  mix_id: string
  parent_id: string | null
  body: string
  created_at: string
  updated_at: string
  user?: Profile
  replies?: Comment[]
}

export interface Notification {
  id: string
  user_id: string
  type: 'like' | 'follow' | 'comment' | 'reply' | 'mix_upload' | 'mention'
  actor_id: string
  mix_id: string | null
  data: Record<string, unknown>
  read: boolean
  created_at: string
  actor?: Profile
  mix?: Mix
}

export interface FeedMix extends Mix {
  dj_username: string
  dj_display_name: string
  dj_avatar_url: string
  weekly_plays?: number
  score?: number
  is_repost?: boolean
  reposted_by_id?: string | null
  reposted_by_username?: string | null
  reposted_by_display_name?: string | null
  reposted_by_avatar_url?: string | null
  feed_event_id?: string
}

export interface Playlist {
  id: string
  owner_id: string
  title: string
  description: string | null
  artwork_url: string | null
  is_public: boolean
  mix_count: number
  created_at: string
  updated_at: string
}

export interface PlaylistMix {
  id: string
  playlist_id: string
  mix_id: string
  position: number
  added_at: string
}

export interface PlaylistWithMixes extends Playlist {
  owner_username: string
  owner_display_name: string
  owner_avatar_url: string
  mixes: PlaylistMixItem[]
}

export interface PlaylistMixItem {
  id: string
  title: string
  artwork_url: string | null
  audio_url: string
  duration_seconds: number | null
  play_count: number
  like_count: number
  genre_name: string | null
  tags: string[]
  waveform_url: string | null
  audio_quality: string | null
  created_at: string
  position: number
  dj_id: string
  dj_username: string
  dj_display_name: string
  dj_avatar_url: string
}

export interface ActivityEvent {
  activity_type: 'upload' | 'like' | 'follow'
  actor_id: string
  target_id: string | null
  mix_id: string | null
  target_username: string | null
  target_display_name: string | null
  mix_title: string | null
  created_at: string
}

export interface RecommendedDJ {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  recent_mix_title: string | null
  recent_mix_created_at: string | null
}

export interface MentionPart {
  type: 'text' | 'mention'
  value: string
}

export function parseMentions(body: string): MentionPart[] {
  const parts: MentionPart[] = []
  const re = /(@[A-Za-z0-9_]+)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: body.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', value: match[1].slice(1) })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < body.length) {
    parts.push({ type: 'text', value: body.slice(lastIndex) })
  }
  return parts
}

export interface FeedCursor {
  created_at: string
  id: string
}

export interface TrendingCursor {
  score: number
  id: string
}

export interface FeedResult {
  data: FeedMix[]
  cursor: FeedCursor | null
}

export interface TrendingResult {
  data: FeedMix[]
  cursor: TrendingCursor | null
}

// ── Buzz (short-form posts) ───────────────────────────────────────────────────

export interface Buzz {
  id: string
  author_id: string
  body: string
  image_url: string | null
  audio_url: string | null
  video_url: string | null
  code_snippet: string | null
  code_language: string | null
  attached_mix_id: string | null
  parent_buzz_id: string | null
  is_repost: boolean
  original_buzz_id: string | null
  like_count: number
  reply_count: number
  repost_count: number
  created_at: string
  updated_at: string
  author?: Profile
  attached_mix?: Mix
}

export interface FeedBuzz extends Buzz {
  feed_event_id?: string
}

export type FeedItem =
  | { type: 'mix'; data: FeedMix }
  | { type: 'buzz'; data: FeedBuzz }

export interface BuzzFeedResult {
  data: FeedBuzz[]
  cursor: FeedCursor | null
}

export interface MixedFeedResult {
  data: FeedItem[]
  mixCursor: FeedCursor | null
  buzzCursor: FeedCursor | null
}
