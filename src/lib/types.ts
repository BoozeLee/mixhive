export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  genres: string[];
  social_links: Record<string, string>;
  is_dj: boolean;
  verified: boolean;
  is_admin?: boolean;
  is_pro?: boolean;
  onboarding_complete?: boolean;
  dj_equipment?: string[];
  dj_daw?: string[];
  dj_style?: string | null;
  created_at: string;
  updated_at: string;
}

export type VerificationBadgeType = 'verified' | 'artist' | 'official' | 'trusted_seller';
export type VerificationRequestStatus = 'pending' | 'approved' | 'rejected';
export type AnalyticsEventType =
  | 'profile_view'
  | 'follow'
  | 'upload'
  | 'play'
  | 'like'
  | 'comment'
  | 'share'
  | 'verification';

/** MythicNode / Quest Types (Phase 6) */
export interface MythicQuest {
  id: string;
  owner_id: string;
  title: string;
  description?: string | null;
  target_scene_tags: string[];
  timeframe_days?: number | null;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  momentum: number;
  created_by_agent_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestMilestone {
  id: string;
  quest_id: string;
  title: string;
  sort_order: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  target_node_type?: string | null;
  completed_at?: string | null;
  completed_via_edge_id?: string | null;
}

export interface QuestWithMilestones extends MythicQuest {
  milestones: QuestMilestone[];
}

export interface VerificationBadge {
  id: string;
  profile_id: string;
  badge_type: VerificationBadgeType;
  label: string;
  reason: string | null;
  granted_by: string | null;
  granted_at: string;
  expires_at: string | null;
}

export interface VerificationRequest {
  id: string;
  profile_id: string;
  dj_name: string;
  links: Record<string, string>;
  proof: string;
  requested_badge: VerificationBadgeType;
  status: VerificationRequestStatus;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface AnalyticsEvent {
  id: string;
  profile_id: string;
  actor_id: string | null;
  mix_id: string | null;
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProfileAnalytics {
  totalPlays: number;
  totalLikes: number;
  totalComments: number;
  totalMixes: number;
  followers: number;
  following: number;
  averagePlaysPerMix: number;
  likeToPlayRatio: number;
  followerEngagementRate: number;
  uploadFrequencyDays: number | null;
  topMixes: Mix[];
  genreDistribution: Array<{ name: string; count: number }>;
  weeklyEvents: Array<{ label: string; count: number }>;
}

export interface Mix {
  id: string;
  dj_id: string;
  title: string;
  description: string | null;
  artwork_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
  genre_id: number | null;
  tags: string[];
  tracklist: TrackItem[];
  platform_links: Record<string, string>;
  is_explicit: boolean;
  play_count: number;
  like_count: number;
  comment_count: number;
  published: boolean;
  status: 'processing' | 'ready' | 'error';
  upload_status?: 'uploaded' | 'processing' | 'ready' | 'failed';
  processing_started_at?: string | null;
  processed_at?: string | null;
  processing_errors?: unknown[] | null;
  waveform_url: string | null;
  waveform_data?: unknown | null;
  audio_metadata?: unknown | null;
  audio_quality: string | null;
  created_at: string;
  updated_at: string;
  dj?: Profile;
  genre_name?: string | null;
  weekly_plays?: number;
}

export interface TrackItem {
  artist: string;
  title: string;
  start_time?: number;
}

export interface Comment {
  id: string;
  user_id: string;
  mix_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  user?: Profile;
  replies?: Comment[];
}

export interface Notification {
  id: string;
  user_id: string;
  type:
    | 'like'
    | 'follow'
    | 'comment'
    | 'reply'
    | 'mix_upload'
    | 'mention'
    | 'buzz_like'
    | 'repost'
    | 'verification';
  actor_id: string;
  mix_id: string | null;
  buzz_id: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
  actor?: Profile;
  mix?: Mix;
}

export type ModerationSignalStatus = 'open' | 'reviewing' | 'actioned' | 'dismissed';
export type ModerationAction = 'hide' | 'ban' | 'dismiss';

export interface ModerationSignal {
  id: string;
  source_table: string;
  source_id: string | null;
  signal_type:
    | 'hate_speech'
    | 'fraud'
    | 'doxxing'
    | 'csam'
    | 'violent_threat'
    | 'text_flagged'
    | 'user_report';
  severity: 'low' | 'medium' | 'high' | 'critical';
  action_taken: string | null;
  flagged_by: string;
  payload: Record<string, unknown>;
  status: ModerationSignalStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface AudioJob {
  id: string;
  mix_id: string;
  job_type: 'waveform' | 'metadata' | 'bpm_key_mood' | 'tracklist';
  status: 'pending' | 'processing' | 'complete' | 'failed';
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface SimilarArtistResult {
  artist_id: string;
  display_name: string | null;
  username: string;
  avatar_url: string | null;
  shared_score: number;
}

export interface RelevantOpportunityResult {
  opp_id: string;
  title: string;
  opp_type: string;
  city: string | null;
  deadline: string | null;
  genres: string[];
  match_score: number;
}

export interface QuestMomentumEntry {
  quest_id: string;
  title: string;
  status: 'active' | 'paused';
  momentum: number;
  milestones_total: number;
  milestones_done: number;
  days_remaining: number | null;
}

export interface FeedMix extends Mix {
  dj_username: string;
  dj_display_name: string;
  dj_avatar_url: string;
  weekly_plays?: number;
  score?: number;
  is_repost?: boolean;
  reposted_by_id?: string | null;
  reposted_by_username?: string | null;
  reposted_by_display_name?: string | null;
  reposted_by_avatar_url?: string | null;
  feed_event_id?: string;
}

export interface Playlist {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  artwork_url: string | null;
  is_public: boolean;
  mix_count: number;
  created_at: string;
  updated_at: string;
}

export interface PlaylistMix {
  id: string;
  playlist_id: string;
  mix_id: string;
  position: number;
  added_at: string;
}

export interface PlaylistWithMixes extends Playlist {
  owner_username: string;
  owner_display_name: string;
  owner_avatar_url: string;
  mixes: PlaylistMixItem[];
}

export interface PlaylistMixItem {
  id: string;
  title: string;
  artwork_url: string | null;
  audio_url: string;
  duration_seconds: number | null;
  play_count: number;
  like_count: number;
  genre_name: string | null;
  tags: string[];
  waveform_url: string | null;
  audio_quality: string | null;
  created_at: string;
  position: number;
  dj_id: string;
  dj_username: string;
  dj_display_name: string;
  dj_avatar_url: string;
}

export interface ActivityEvent {
  activity_type: 'upload' | 'like' | 'follow';
  actor_id: string;
  target_id: string | null;
  mix_id: string | null;
  target_username: string | null;
  target_display_name: string | null;
  mix_title: string | null;
  created_at: string;
}

export interface RecommendedDJ {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  recent_mix_title: string | null;
  recent_mix_created_at: string | null;
}

export interface MentionPart {
  type: 'text' | 'mention';
  value: string;
}

export function parseMentions(body: string): MentionPart[] {
  const parts: MentionPart[] = [];
  const re = /(@[A-Za-z0-9_]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: body.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'mention', value: match[1].slice(1) });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push({ type: 'text', value: body.slice(lastIndex) });
  }
  return parts;
}

export interface FeedCursor {
  created_at: string;
  id: string;
}

export interface TrendingCursor {
  score: number;
  id: string;
}

export interface FeedResult {
  data: FeedMix[];
  cursor: FeedCursor | null;
}

export interface TrendingResult {
  data: FeedMix[];
  cursor: TrendingCursor | null;
}

// ── Buzz (short-form posts) ───────────────────────────────────────────────────

export interface Buzz {
  id: string;
  author_id: string;
  body: string;
  image_url: string | null;
  audio_url: string | null;
  video_url: string | null;
  code_snippet: string | null;
  code_language: string | null;
  attached_mix_id: string | null;
  parent_buzz_id: string | null;
  is_repost: boolean;
  original_buzz_id: string | null;
  like_count: number;
  reply_count: number;
  repost_count: number;
  created_at: string;
  updated_at: string;
  author?: Profile | undefined;
  attached_mix?: Mix | undefined;
}

export interface FeedBuzz extends Buzz {
  feed_event_id?: string;
}

export type FeedItem = { type: 'mix'; data: FeedMix } | { type: 'buzz'; data: FeedBuzz };

export interface BuzzFeedResult {
  data: FeedBuzz[];
  cursor: FeedCursor | null;
}

export interface MixedFeedResult {
  data: FeedItem[];
  mixCursor: FeedCursor | null;
  buzzCursor: FeedCursor | null;
}

// ── AI Infrastructure ─────────────────────────────────────────────────────────

export type AISuggestionType =
  | 'profile_bio'
  | 'profile_coach'
  | 'epk'
  | 'opportunity_match'
  | 'collab_match';
export type AISuggestionStatus = 'pending' | 'applied' | 'rejected' | 'edited';
export type AISuggestionSource = 'gpt' | 'claude' | 'rule';
export type AIFeedbackOutcome = 'used' | 'modified' | 'ignored';
export type CreatorTaskType =
  | 'complete_profile'
  | 'upload_mix'
  | 'apply_opportunity'
  | 'review_suggestion';
export type CreatorTaskStatus = 'open' | 'snoozed' | 'done';
export type OpportunityType =
  | 'gig'
  | 'grant'
  | 'residency'
  | 'contest'
  | 'festival'
  | 'collab_call'
  | 'radio';
export type OpportunitySaveStatus = 'saved' | 'applied' | 'dismissed';

export interface AISuggestion {
  id: string;
  owner_id: string;
  suggestion_type: AISuggestionType;
  payload: Record<string, unknown>;
  rationale: string | null;
  confidence: number | null;
  status: AISuggestionStatus;
  source: AISuggestionSource;
  model: string | null;
  version: number;
  applied_at: string | null;
  rejected_at: string | null;
  created_at: string;
  // Discovery agent tracking fields (doc 33)
  rank?: number;
  candidate_id?: string;
}

export interface AIFeedback {
  id: string;
  suggestion_id: string;
  owner_id: string;
  rating: number | null;
  comment: string | null;
  outcome: AIFeedbackOutcome | null;
  created_at: string;
}

export interface CreatorTask {
  id: string;
  owner_id: string;
  task_type: CreatorTaskType;
  title: string;
  priority: number;
  due_date: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  status: CreatorTaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string | null;
  opp_type: OpportunityType;
  source: string;
  source_url: string | null;
  organizer: string | null;
  location: string | null;
  city: string | null;
  country: string;
  compensation: string | null;
  deadline: string | null;
  genres: string[];
  roles: string[];
  tags: string[];
  is_active: boolean;
  created_at: string;
}

export interface ArtistGoals {
  user_id: string;
  goals: string[];
  skills: string[];
  travel_radius_km: number;
  base_city: string | null;
  booking_open: boolean;
  updated_at: string;
}

export interface OpportunitySave {
  id: string;
  user_id: string;
  opportunity_id: string;
  status: OpportunitySaveStatus;
  draft_text: string | null;
  created_at: string;
}

export interface RecommendationScore {
  id: string;
  owner_id: string;
  target_type: string;
  target_id: string | null;
  target_key: string | null;
  score: number;
  rationale: string | null;
  model: string | null;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIEmbedding {
  id: string;
  owner_id: string | null;
  entity_type: string;
  entity_id: string | null;
  entity_key: string | null;
  model: string;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OpportunityMatch {
  opportunity: Opportunity;
  score: number;
  rationale: string;
}

export interface PressKitContent {
  artist_name: string;
  location: string | null;
  bio: string | null;
  genres: string[];
  website: string | null;
  social_links: Record<string, string>;
  avatar_url: string | null;
  top_mixes: Array<{
    id: string;
    title: string;
    play_count: number;
    like_count: number;
    url_path: string;
  }>;
  booking_pitch: string;
  technical_notes: string[];
  generated_from: string[];
}

export interface PressKit {
  id: string;
  owner_id: string;
  public_slug: string;
  version: number;
  title: string;
  content: PressKitContent;
  pdf_url: string | null;
  is_public: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export type AudioAnalysisStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface AudioStructureSection {
  label: string;
  start_sec: number;
  end_sec: number;
  energy: number;
}

export interface AudioFeature {
  id: string;
  mix_id: string;
  status: AudioAnalysisStatus;
  bpm: number | null;
  musical_key: string | null;
  camelot: string | null;
  mood: string | null;
  energy: number | null;
  danceability: number | null;
  structure_json: {
    sections?: AudioStructureSection[];
    summary?: string;
    [key: string]: unknown;
  };
  source: string;
  model: string | null;
  confidence: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MixTrack {
  id: string;
  mix_id: string;
  title: string | null;
  artist: string | null;
  label: string | null;
  start_sec: number;
  end_sec: number | null;
  confidence: number | null;
  source: string;
  created_at: string;
}
