import { createServerClient } from '@/lib/supabase';

export interface AudioJob {
  id: string;
  mix_id: string;
  job_type: 'waveform' | 'metadata' | 'bpm_key_mood' | 'tracklist';
  status: 'pending' | 'processing' | 'complete' | 'failed';
  retry_count: number;
  max_retries: number;
  error_message?: string;
  result?: any;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface AudioJobResult {
  mixId: string;
  success: boolean;
  waveformUrl?: string;
  waveformData?: number[];
  durationSeconds?: number;
  audioMetadata?: any;
  error?: string;
  processingErrors?: any[];
}

export interface LogPerformanceParams {
  artistId: string;
  date: string; // ISO timestamp
  venueName: string;
  city?: string | null;
  role?: string;
  coBilled?: string[];
  promoterName?: string | null;
  notes?: string | null;
  link?: string | null;
}

export interface LogPerformanceResult {
  success: boolean;
  nodesCreated: number;
  edgesCreated: number;
  venueId?: string;
  eventId?: string;
  error?: string;
}

/**
 * Enqueue an audio processing job using the database function
 */
export async function enqueue_audio_job(
  mixId: string,
  jobType: 'waveform' | 'metadata' | 'bpm_key_mood' | 'tracklist' = 'waveform',
  maxRetries: number = 3
): Promise<string> {
  const supabase = createServerClient();
  
  const { data: jobId, error } = await supabase
    .rpc('enqueue_audio_job', {
      p_mix_id: mixId,
      p_job_type: jobType,
      p_max_retries: maxRetries
    });

  if (error) {
    throw new Error(`Failed to enqueue audio job: ${error.message}`);
  }

  return jobId;
}

/**
 * Mark a job as processing
 */
export async function mark_audio_job_processing(jobId: string): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .rpc('mark_audio_job_processing', { p_job_id: jobId });

  if (error) {
    throw new Error(`Failed to mark job as processing: ${error.message}`);
  }
}

/**
 * Mark a job as complete with results
 */
export async function mark_audio_job_complete(
  jobId: string,
  result: any
): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .rpc('mark_audio_job_complete', {
      p_job_id: jobId,
      p_result: result
    });

  if (error) {
    throw new Error(`Failed to mark job as complete: ${error.message}`);
  }
}

/**
 * Mark a job as failed
 */
export async function mark_audio_job_failed(
  jobId: string,
  errorMessage: string,
  shouldRetry: boolean = true
): Promise<void> {
  const supabase = createServerClient();
  
  const { error } = await supabase
    .rpc('mark_audio_job_failed', {
      p_job_id: jobId,
      p_error_message: errorMessage,
      p_should_retry: shouldRetry
    });

  if (error) {
    throw new Error(`Failed to mark job as failed: ${error.message}`);
  }
}

/**
 * Get pending audio jobs for processing
 */
export async function get_pending_audio_jobs(
  limit: number = 10,
  jobType?: string
): Promise<AudioJob[]> {
  const supabase = createServerClient();
  
  let query = supabase
    .from('audio_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (jobType) {
    query = query.eq('job_type', jobType);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get pending jobs: ${error.message}`);
  }

  return data || [];
}

/**
 * Get job by ID
 */
export async function get_audio_job(jobId: string): Promise<AudioJob | null> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('audio_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Job not found
    }
    throw new Error(`Failed to get job: ${error.message}`);
  }

  return data;
}

/**
 * Get all jobs for a specific mix
 */
export async function get_mix_audio_jobs(mixId: string): Promise<AudioJob[]> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .from('audio_jobs')
    .select('*')
    .eq('mix_id', mixId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get mix jobs: ${error.message}`);
  }

  return data || [];
}

/**
 * Cleanup old completed jobs
 */
export async function cleanup_completed_audio_jobs(
  daysToKeep: number = 30
): Promise<number> {
  const supabase = createServerClient();
  
  const { data, error } = await supabase
    .rpc('cleanup_completed_audio_jobs', { p_days_to_keep: daysToKeep });

  if (error) {
    throw new Error(`Failed to cleanup jobs: ${error.message}`);
  }

  return data || 0;
}

/**
 * Update mix upload status and processing information
 */
export async function update_mix_processing_status(
  mixId: string,
  status: 'uploaded' | 'processing' | 'ready' | 'error',
  updates?: {
    processingStartedAt?: string;
    processingCompletedAt?: string;
    processingErrors?: any[];
    waveformUrl?: string;
    durationSeconds?: number;
    audioMetadata?: any;
  }
): Promise<void> {
  const supabase = createServerClient();
  
  const updateData: any = { upload_status: status };
  
  if (updates?.processingStartedAt) {
    updateData.processing_started_at = updates.processingStartedAt;
  }
  
  if (updates?.processingCompletedAt) {
    updateData.processing_completed_at = updates.processingCompletedAt;
  }
  
  if (updates?.processingErrors) {
    updateData.processing_errors = updates.processingErrors;
  }
  
  if (updates?.waveformUrl) {
    updateData.waveform_url = updates.waveformUrl;
  }
  
  if (updates?.durationSeconds !== undefined) {
    updateData.duration_seconds = updates.durationSeconds;
  }
  
  if (updates?.audioMetadata) {
    updateData.audio_metadata = updates.audioMetadata;
  }

  const { error } = await supabase
    .from('mixes')
    .update(updateData)
    .eq('id', mixId);

  if (error) {
    throw new Error(`Failed to update mix processing status: ${error.message}`);
  }
}

// ============================================================================
// MythicNode Graph Jobs (added in migration 043)
// ============================================================================

export interface MythicGraphJob {
  id: string;
  scope: Record<string, any>;
  job_type: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  retry_count: number;
  max_retries: number;
  error_message?: string;
  result?: any;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
}

export async function enqueue_mythic_graph_job(
  scope: Record<string, any>,
  jobType: string,
  maxRetries: number = 3
): Promise<string> {
  const supabase = createServerClient();

  const { data: jobId, error } = await supabase.rpc('enqueue_mythic_graph_job', {
    p_scope: scope,
    p_job_type: jobType,
    p_max_retries: maxRetries,
  });

  if (error) {
    throw new Error(`Failed to enqueue mythic graph job: ${error.message}`);
  }

  return jobId;
}

export async function get_pending_mythic_graph_jobs(limit: number = 10): Promise<MythicGraphJob[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('mythic_graph_jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get pending mythic graph jobs: ${error.message}`);
  }

  return data || [];
}

export async function get_mythic_graph_job(jobId: string): Promise<MythicGraphJob | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('mythic_graph_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // not found
    throw new Error(`Failed to get mythic graph job: ${error.message}`);
  }

  return data;
}

export async function mark_mythic_graph_job_processing(jobId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('mark_mythic_graph_job_processing', {
    p_job_id: jobId,
  });

  if (error) {
    throw new Error(`Failed to mark mythic graph job as processing: ${error.message}`);
  }
}

export async function mark_mythic_graph_job_complete(
  jobId: string,
  result?: any
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('mark_mythic_graph_job_complete', {
    p_job_id: jobId,
    p_result: result ?? null,
  });

  if (error) {
    throw new Error(`Failed to mark mythic graph job as complete: ${error.message}`);
  }
}

export async function mark_mythic_graph_job_failed(
  jobId: string,
  errorMessage: string,
  shouldRetry = true
): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('mark_mythic_graph_job_failed', {
    p_job_id: jobId,
    p_error_message: errorMessage,
    p_should_retry: shouldRetry,
  });

  if (error) {
    throw new Error(`Failed to mark mythic graph job as failed: ${error.message}`);
  }
}

/**
 * Log a real-world performance (gig).
 * Calls the security-definer RPC created in migration 048.
 * This is the core primitive for Experiment 5 (Mythic Tour Weaver).
 */
export async function log_performance(
  params: LogPerformanceParams
): Promise<LogPerformanceResult> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('log_performance', {
    p_artist_id: params.artistId,
    p_date: params.date,
    p_venue_name: params.venueName,
    p_city: params.city ?? null,
    p_role: params.role ?? 'support',
    p_co_billed: params.coBilled ?? [],
    p_promoter_name: params.promoterName ?? null,
    p_notes: params.notes ?? null,
    p_link: params.link ?? null,
  });

  if (error) {
    console.error('log_performance RPC error:', error);
    return {
      success: false,
      nodesCreated: 0,
      edgesCreated: 0,
      error: error.message,
    };
  }

  return data as LogPerformanceResult;
}

// ============================================
// Experiment 1: Collab Sessions Helpers
// ============================================

export interface CreateCollabSessionParams {
  title: string;
  description?: string | null;
  isPublic?: boolean;
}

export async function create_collab_session(
  params: CreateCollabSessionParams
): Promise<{ id: string } | null> {
  const supabase = createServerClient();

  const { data, error } = await supabase.rpc('create_collab_session', {
    p_title: params.title,
    p_description: params.description ?? null,
    p_is_public: params.isPublic ?? false,
  });

  if (error) {
    console.error('create_collab_session error:', error);
    throw new Error(error.message);
  }

  return data ? { id: data } : null;
}

export async function end_collab_session(sessionId: string): Promise<void> {
  const supabase = createServerClient();

  const { error } = await supabase.rpc('end_collab_session', {
    p_session_id: sessionId,
  });

  if (error) {
    console.error('end_collab_session error:', error);
    throw new Error(error.message);
  }
}