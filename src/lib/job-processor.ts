import { audioProcessingWorker, AudioProcessingConfig } from './audio-processing';
import { mythicGraphProcessingWorker } from './mythic-graph-processing';
import {
  get_pending_audio_jobs,
  mark_audio_job_failed,
  get_pending_mythic_graph_jobs,
} from './database-queries';
import { createServerClient } from './supabase';

export interface JobProcessorConfig {
  batchSize: number;
  processIntervalMs: number;
  maxConcurrentJobs: number;
  enableLogging: boolean;
}

export const DEFAULT_JOB_PROCESSOR_CONFIG: JobProcessorConfig = {
  batchSize: 5,
  processIntervalMs: 5000, // 5 seconds
  maxConcurrentJobs: 3,
  enableLogging: true
};

/**
 * Job Processor for handling audio processing jobs
 */
export class JobProcessor {
  private config: JobProcessorConfig;
  private isRunning: boolean = false;
  private activeJobs: Set<string> = new Set();
  private intervalId: NodeJS.Timeout | null = null;

  constructor(config: JobProcessorConfig = DEFAULT_JOB_PROCESSOR_CONFIG) {
    this.config = config;
  }

  /**
   * Start the job processor
   */
  start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.log('Job processor started');

    // Start processing jobs
    this.intervalId = setInterval(() => {
      this.processJobs();
    }, this.config.processIntervalMs);

    // Process immediately on start
    this.processJobs();
  }

  /**
   * Stop the job processor
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.log('Job processor stopped');
  }

  /**
   * Process pending jobs
   */
  private async processJobs(): Promise<void> {
    if (this.activeJobs.size >= this.config.maxConcurrentJobs) {
      this.log(`Max concurrent jobs (${this.config.maxConcurrentJobs}) reached, skipping batch`);
      return;
    }

    try {
      const availableSlots = this.config.maxConcurrentJobs - this.activeJobs.size;
      const batchSize = Math.min(this.config.batchSize, availableSlots);

      if (batchSize <= 0) {
        return;
      }

      const audioJobs = await get_pending_audio_jobs(batchSize);
      const mythicJobs = await get_pending_mythic_graph_jobs(Math.max(1, Math.floor(batchSize / 2)));

      const allJobs = [
        ...audioJobs.map((j: any) => ({ ...j, _domain: 'audio' })),
        ...mythicJobs.map((j: any) => ({ ...j, _domain: 'mythic_graph' })),
      ];

      if (allJobs.length === 0) {
        this.log('No pending jobs found');
        return;
      }

      this.log(`Processing ${allJobs.length} jobs (${audioJobs.length} audio, ${mythicJobs.length} mythic_graph)`);

      // Process jobs concurrently
      const jobPromises = allJobs.map(job => this.processJob(job));
      await Promise.allSettled(jobPromises);

    } catch (error) {
      this.log('Error processing job batch:', error);
    }
  }

  /**
   * Process a single job (supports both audio and mythic_graph domains)
   */
  private async processJob(job: any): Promise<void> {
    const jobId = job.id;
    const domain = job._domain || 'audio';
    
    // Check if job is already being processed (safety check)
    if (this.activeJobs.has(jobId)) {
      this.log(`Job ${jobId} is already being processed`);
      return;
    }

    // Add to active jobs
    this.activeJobs.add(jobId);
    this.log(`Starting ${domain} job ${jobId} (${job.job_type})`);

    try {
      if (domain === 'mythic_graph') {
        await mythicGraphProcessingWorker.processJob(jobId);
      } else {
        // Default to audio processing (existing behavior)
        await audioProcessingWorker.processJob(jobId);
      }
      
      this.log(`Completed ${domain} job ${jobId} successfully`);

    } catch (error) {
      this.log(`${domain} job ${jobId} failed:`, error);
      
      // Handle failure marking based on domain
      if (job.retry_count >= job.max_retries) {
        try {
          if (domain === 'mythic_graph') {
            // We already handle marking inside the mythic worker for now
            this.log(`Mythic graph job ${jobId} marked as failed (handled in worker)`);
          } else {
            await mark_audio_job_failed(
              jobId, 
              error instanceof Error ? error.message : 'Unknown error',
              false
            );
            this.log(`Audio job ${jobId} marked as failed permanently`);
          }
        } catch (dbError) {
          this.log(`Failed to mark ${domain} job ${jobId} as failed in DB:`, dbError);
        }
      }

    } finally {
      // Remove from active jobs
      this.activeJobs.delete(jobId);
      this.log(`Removed ${domain} job ${jobId} from active jobs`);
    }
  }

  /**
   * Get processor status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    maxConcurrentJobs: number;
    config: JobProcessorConfig;
  } {
    return {
      isRunning: this.isRunning,
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      config: this.config
    };
  }

  /**
   * Force process a specific job (for testing/debugging)
   */
  async processJobManually(jobId: string): Promise<void> {
    this.log(`Manually processing job ${jobId}`);
    
    try {
      const supabase = createServerClient();
      const { data: job } = await supabase
        .from('audio_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      await this.processJob(job);
      
    } catch (error) {
      this.log(`Manual processing of job ${jobId} failed:`, error);
      throw error;
    }
  }

  /**
   * Cleanup completed jobs older than specified days
   */
  async cleanupOldJobs(days: number = 30): Promise<number> {
    this.log(`Cleaning up jobs older than ${days} days`);
    
    try {
      const supabase = createServerClient();
      
      // This would call the cleanup function from database-queries
      // For now, we'll implement a basic cleanup
      const { data, error } = await supabase
        .rpc('cleanup_completed_audio_jobs', { p_days_to_keep: days });

      if (error) {
        throw error;
      }

      const cleanedCount = data || 0;
      this.log(`Cleaned up ${cleanedCount} old jobs`);
      
      return cleanedCount;
      
    } catch (error) {
      this.log('Cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Enable or disable logging
   */
  setLogging(enabled: boolean): void {
    this.config.enableLogging = enabled;
  }

  /**
   * Update processor configuration
   */
  updateConfig(newConfig: Partial<JobProcessorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.log('Job processor configuration updated:', this.config);
  }

  /**
   * Log helper method
   */
  private log(message: string, ...args: any[]): void {
    if (this.config.enableLogging) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] JobProcessor: ${message}`, ...args);
    }
  }
}

// Create default instance
export const jobProcessor = new JobProcessor();

// Auto-start processor in development mode
if (process.env.NODE_ENV === 'development') {
  jobProcessor.start();
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  jobProcessor.stop();
});

process.on('SIGINT', () => {
  jobProcessor.stop();
});