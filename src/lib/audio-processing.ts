import { spawn } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fs from 'fs/promises';
import path from 'path';
import { createServerClient } from './supabase';
import {
  mark_audio_job_processing,
  mark_audio_job_complete,
  mark_audio_job_failed,
  get_audio_job,
  AudioJobResult,
} from './database-queries';

const pipelineAsync = promisify(pipeline);

export interface AudioProcessingConfig {
  maxRetries: number;
  timeoutMs: number;
  waveformPoints: number;
  supportedFormats: string[];
  tempDir: string;
  storageBucket: string;
}

export const AUDIO_PROCESSING_CONFIG: AudioProcessingConfig = {
  maxRetries: 3,
  timeoutMs: 300000, // 5 minutes
  waveformPoints: 200,
  supportedFormats: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'],
  tempDir: '/tmp/mixhive-audio',
  storageBucket: 'mixhive-audio',
};

/**
 * Audio processing worker for handling different types of audio jobs
 */
export class AudioProcessingWorker {
  private config: AudioProcessingConfig;

  constructor(config: AudioProcessingConfig = AUDIO_PROCESSING_CONFIG) {
    this.config = config;
  }

  /**
   * Process an audio job
   */
  async processJob(jobId: string): Promise<void> {
    const job = await get_audio_job(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Mark job as processing
      await mark_audio_job_processing(jobId);

      const result = await this.processAudioJob(job);

      // Mark job as complete
      await mark_audio_job_complete(jobId, result);
    } catch (error) {
      console.error(`Audio processing failed for job ${jobId}:`, error);

      // Mark job as failed with retry logic
      const shouldRetry = job.retry_count < job.max_retries;
      await mark_audio_job_failed(
        jobId,
        error instanceof Error ? error.message : 'Unknown error',
        shouldRetry
      );

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  /**
   * Process audio based on job type
   */
  private async processAudioJob(job: Record<string, unknown>): Promise<AudioJobResult> {
    const { mix_id: mixId, job_type: jobType } = job;

    // Get mix details including audio URL
    const supabase = createServerClient();
    const { data: mix } = await supabase
      .from('mixes')
      .select('file_url, title')
      .eq('id', mixId)
      .single();

    if (!mix || !mix.file_url) {
      throw new Error('Mix not found or missing audio URL');
    }

    // Download audio file to temp location
    const tempFilePath = await this.downloadAudioFile(mix.file_url, mixId);

    try {
      let result: AudioJobResult;

      switch (jobType) {
        case 'waveform':
          result = await this.extractWaveform(tempFilePath, mixId);
          break;
        case 'metadata':
          result = await this.extractMetadata(tempFilePath, mixId);
          break;
        case 'bpm_key_mood':
          result = await this.extractAudioFeatures(tempFilePath, mixId);
          break;
        case 'tracklist':
          result = await this.extractTracklist(tempFilePath, mixId);
          break;
        default:
          throw new Error(`Unsupported job type: ${jobType}`);
      }

      return {
        ...result,
        mixId,
      };
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFilePath);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp file:', cleanupError);
      }
    }
  }

  /**
   * Download audio file to temporary location
   */
  private async downloadAudioFile(audioUrl: string, mixId: string): Promise<string> {
    const supabase = createServerClient();

    // Create temp directory if it doesn't exist
    await fs.mkdir(this.config.tempDir, { recursive: true });

    // Extract file extension from URL or default to mp3
    const fileExtension = path.extname(new URL(audioUrl).pathname) || '.mp3';
    const tempFilePath = path.join(this.config.tempDir, `${mixId}-${Date.now()}${fileExtension}`);

    // Download the file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    const writableStream = fs.createWriteStream(tempFilePath);
    await pipelineAsync(response.body, writableStream);

    return tempFilePath;
  }

  /**
   * Extract waveform data from audio file
   */
  private async extractWaveform(filePath: string, mixId: string): Promise<AudioJobResult> {
    const waveformPoints = this.config.waveformPoints;

    // Use ffmpeg to extract waveform data
    const ffmpegCommand = 'ffmpeg';
    const args = [
      '-i',
      filePath,
      '-filter_complex',
      `showwavespic=s=${waveformPoints}:1:colors=white`,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      'pipe:1',
    ];

    const ffmpeg = spawn(ffmpegCommand, args);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      ffmpeg.stderr.on('data', data => {
        // Log ffmpeg progress/errors
        if (data.toString().includes('error')) {
          console.warn('FFmpeg stderr:', data.toString());
        }
      });

      ffmpeg.stdout.on('data', data => {
        chunks.push(data);
      });

      ffmpeg.on('close', async code => {
        if (code !== 0) {
          reject(new Error(`FFmpeg exited with code ${code}`));
          return;
        }

        const imageBuffer = Buffer.concat(chunks);

        // Upload waveform image to Supabase Storage
        const waveformUrl = await this.uploadWaveform(imageBuffer, mixId);

        // Also extract duration for the waveform job
        const duration = await this.getAudioDuration(filePath);

        resolve({
          mixId,
          success: true,
          waveformUrl,
          durationSeconds: duration,
        });
      });

      ffmpeg.on('error', error => {
        reject(new Error(`FFmpeg spawn error: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        ffmpeg.kill();
        reject(new Error('Audio processing timeout'));
      }, this.config.timeoutMs);
    });
  }

  /**
   * Extract basic metadata from audio file
   */
  private async extractMetadata(filePath: string, mixId: string): Promise<AudioJobResult> {
    const ffprobeCommand = 'ffprobe';
    const args = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    return new Promise((resolve, reject) => {
      const ffprobe = spawn(ffprobeCommand, args);
      let output = '';

      ffprobe.stdout.on('data', data => {
        output += data.toString();
      });

      ffprobe.stderr.on('data', data => {
        console.warn('FFProbe stderr:', data.toString());
      });

      ffprobe.on('close', code => {
        if (code !== 0) {
          reject(new Error(`FFProbe exited with code ${code}`));
          return;
        }

        try {
          const metadata = JSON.parse(output);
          const duration = parseFloat(metadata.format.duration) || 0;

          resolve({
            mixId,
            success: true,
            durationSeconds: duration,
            audioMetadata: {
              format: metadata.format,
              streams: metadata.streams,
            },
          });
        } catch (error) {
          reject(new Error(`Failed to parse metadata: ${error.message}`));
        }
      });

      ffprobe.on('error', error => {
        reject(new Error(`FFProbe spawn error: ${error.message}`));
      });

      // Set timeout
      setTimeout(() => {
        ffprobe.kill();
        reject(new Error('Metadata extraction timeout'));
      }, this.config.timeoutMs);
    });
  }

  /**
   * Extract advanced audio features (BPM, key, mood)
   */
  private async extractAudioFeatures(filePath: string, mixId: string): Promise<AudioJobResult> {
    // For now, return placeholder data - in production, you'd integrate with
    // services like Essentia, Librosa, or specialized audio analysis APIs

    return {
      mixId,
      success: true,
      audioMetadata: {
        bpm: null,
        key: null,
        mood: [],
        energy: null,
        danceability: null,
        analysisNote: 'Advanced audio features not implemented - placeholder data',
      },
    };
  }

  /**
   * Extract tracklist from audio file
   */
  private async extractTracklist(filePath: string, mixId: string): Promise<AudioJobResult> {
    // For now, return placeholder data - in production, you'd integrate with
    // services like AudD, Shazam, or custom audio fingerprinting

    return {
      mixId,
      success: true,
      audioMetadata: {
        tracklist: [],
        analysisNote: 'Tracklist extraction not implemented - placeholder data',
      },
    };
  }

  /**
   * Get audio duration using ffprobe
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    const ffprobeCommand = 'ffprobe';
    const args = ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath];

    return new Promise((resolve, reject) => {
      const ffprobe = spawn(ffprobeCommand, args);
      let output = '';

      ffprobe.stdout.on('data', data => {
        output += data.toString();
      });

      ffprobe.on('close', code => {
        if (code !== 0) {
          reject(new Error(`FFProbe exited with code ${code}`));
          return;
        }

        const duration = parseFloat(output.trim());
        resolve(isNaN(duration) ? 0 : duration);
      });

      ffprobe.on('error', error => {
        reject(new Error(`FFProbe spawn error: ${error.message}`));
      });
    });
  }

  /**
   * Upload waveform image to Supabase Storage
   */
  private async uploadWaveform(imageBuffer: Buffer, mixId: string): Promise<string> {
    const supabase = createServerClient();

    const fileName = `waveforms/${mixId}.png`;
    const { data, error } = await supabase.storage
      .from(this.config.storageBucket)
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload waveform: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(this.config.storageBucket)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  /**
   * Check if file format is supported
   */
  isFormatSupported(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase().substring(1);
    return this.config.supportedFormats.includes(extension);
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats(): string[] {
    return [...this.config.supportedFormats];
  }
}

// Create default instance
export const audioProcessingWorker = new AudioProcessingWorker();
