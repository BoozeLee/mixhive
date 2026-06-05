/**
 * Audio Worker Contract — Phase 3
 *
 * Defines the interface between the MixHive Next.js application and the
 * background audio processing worker (external service or future microservice).
 *
 * Current status: Defined but NOT yet implemented. The worker service does not
 * exist yet. These are the contracts for when it's built.
 *
 * ===== Trigger =====
 *
 * When a mix's upload_status transitions from 'uploaded' to 'processing',
 * the application OR a scheduled job should enqueue an audio processing job.
 *
 * ===== Input =====
 *
 * {
 *   mixId: string,
 *   audioUrl: string,       // Supabase signed URL or public URL
 *   userId: string,
 *   requestedAt: string     // ISO 8601
 * }
 *
 * ===== Processing Steps =====
 *
 * 1. Download audio from audioUrl
 * 2. Validate audio file integrity (header, duration, sample rate)
 * 3. Extract waveform data (array of amplitude samples, ~200 points)
 * 4. Extract duration in seconds
 * 5. (Future) BPM/key/mood analysis
 * 6. (Future) Tracklist recognition
 * 7. Upload results to Supabase
 * 8. Update mixes record with results
 * 9. Set upload_status = 'ready' (or 'error' on failure)
 *
 * ===== Output (written to DB) =====
 *
 * mixes table updates:
 * - waveform_url: string | null     — URL to waveform JSON/PNG
 * - duration_seconds: number        — validated duration
 * - upload_status: 'ready' | 'error'
 * - processing_completed_at: string | null
 * - processing_errors: any[]        — empty on success
 *
 * audio_features table insert (migration 034):
 * - mix_id: string
 * - bpm: number | null
 * - key: string | null
 * - mood: string[] | null
 * - energy: number | null
 * - danceability: number | null
 * - status: 'complete' | 'failed'
 *
 * ===== API Endpoint (to be created) =====
 *
 * POST /api/audio/process
 * Auth: Service-role key (not user-facing)
 * Body: { mixId: string }
 * Response: { jobId: string, status: 'queued' }
 *
 * ===== Error Handling =====
 *
 * - If audio URL is unreachable: set upload_status = 'error', add error to processing_errors
 * - If file is corrupt/malformed: set upload_status = 'error', add validation error
 * - If worker crashes: job should be retried up to 3 times with exponential backoff
 * - All errors must be recorded in mixes.processing_errors JSONB array
 */

export interface AudioJob {
  mixId: string;
  audioUrl: string;
  userId: string;
  requestedAt: string;
}

export interface AudioJobResult {
  mixId: string;
  success: boolean;
  waveformUrl?: string | null;
  durationSeconds?: number;
  bpm?: number | null;
  key?: string | null;
  mood?: string[];
  energy?: number;
  danceability?: number;
  error?: string;
  processingErrors?: unknown[];
}

export const AUDIO_WORKER_CONFIG = {
  maxRetries: 3,
  retryDelayMs: 5000,
  timeoutMs: 300000, // 5 minutes
  waveformPoints: 200,
  supportedFormats: ['mp3', 'wav', 'flac', 'ogg', 'aac'] as const,
};
