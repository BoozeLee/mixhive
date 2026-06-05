// MixHive audio worker — the always-on consumer of the public.audio_jobs queue.
//
// Replaces the dormant TS JobProcessor (src/lib/job-processor.ts) that was defined
// but never run on Vercel. Runs continuously under Podman on the self-hosted tier:
// polls for pending jobs, processes them with ffmpeg, and writes the real waveform
// peaks + duration back to the mixes row. Stdlib-only; single static binary.
package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"
)

var version = "dev"

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)

	// --selftest <file>: decode a local audio file and print the analysis. Lets us
	// verify the ffmpeg pipeline with no network/Supabase (used in CI + local dev).
	if len(os.Args) >= 3 && os.Args[1] == "--selftest" {
		runSelfTest(os.Args[2])
		return
	}

	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	sb := newSupabase(cfg)

	log.Printf("mixhive audio worker %s starting — poll=%s concurrency=%d bucket=%s",
		version, cfg.PollInterval, cfg.MaxConcurrent, cfg.AudioBucket)

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	sem := make(chan struct{}, cfg.MaxConcurrent)
	var wg sync.WaitGroup

	ticker := time.NewTicker(cfg.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Printf("shutdown signal received — draining %d in-flight jobs", len(sem))
			wg.Wait()
			log.Printf("clean shutdown")
			return
		case <-ticker.C:
			// Drain as many pending jobs as we have free slots for this tick.
			for {
				select {
				case sem <- struct{}{}:
				default:
					goto doneTick // pool full
				}
				job, err := sb.claimNextJob(ctx)
				if err != nil {
					log.Printf("claim error: %v", err)
					<-sem
					goto doneTick
				}
				if job == nil {
					<-sem
					goto doneTick // nothing pending
				}
				wg.Add(1)
				go func(j *AudioJob) {
					defer wg.Done()
					defer func() { <-sem }()
					handleJob(ctx, cfg, sb, j)
				}(job)
			}
		doneTick:
		}
	}
}

func handleJob(parent context.Context, cfg *Config, sb *Supabase, job *AudioJob) {
	ctx, cancel := context.WithTimeout(parent, cfg.JobTimeout)
	defer cancel()

	start := time.Now()
	log.Printf("job %s type=%s mix=%s start", job.ID, job.JobType, job.MixID)

	if err := processJob(ctx, cfg, sb, job); err != nil {
		log.Printf("job %s FAILED: %v", job.ID, err)
		if ferr := sb.failJob(ctx, job, err.Error()); ferr != nil {
			log.Printf("job %s could not mark failed: %v", job.ID, ferr)
		}
		return
	}
	log.Printf("job %s done in %s", job.ID, time.Since(start).Round(time.Millisecond))
}

func processJob(ctx context.Context, cfg *Config, sb *Supabase, job *AudioJob) error {
	mix, err := sb.getMix(ctx, job.MixID)
	if err != nil {
		return err
	}
	if mix.AudioURL == "" {
		return errEmptyAudio
	}

	switch job.JobType {
	case "waveform", "metadata", "bpm_key_mood", "":
		audio, err := sb.download(ctx, mix.AudioURL)
		if err != nil {
			return err
		}
		a, err := analyze(ctx, audio, cfg.WaveformPoints)
		if err != nil {
			return err
		}
		// Write the real waveform + duration onto the mix.
		if err := sb.updateMix(ctx, job.MixID, map[string]any{
			"waveform_data":    a.Peaks,
			"duration_seconds": int(a.DurationSec + 0.5),
		}); err != nil {
			return err
		}
		// For bpm_key_mood jobs, also upsert the computed audio features.
		// (waveform jobs do it too — cheap, and keeps features fresh.)
		if err := sb.upsertAudioFeatures(ctx, job.MixID, a); err != nil {
			log.Printf("job %s: audio_features upsert warning: %v", job.ID, err)
		}
		return sb.completeJob(ctx, job.ID, map[string]any{
			"success":          true,
			"duration_seconds": a.DurationSec,
			"waveform_points":  len(a.Peaks),
			"bpm":              a.BPM,
			"energy":           a.Energy,
			"mood":             a.Mood,
			"key":              nil,
			"key_note":         "key detection pending (chroma analyzer)",
			"job_type":         job.JobType,
		})
	case "tracklist":
		// Tracklist/fingerprinting is a future analyzer; mark complete with a note
		// so the job doesn't sit pending forever.
		return sb.completeJob(ctx, job.ID, map[string]any{
			"success": true,
			"note":    "tracklist analyzer not yet implemented",
		})
	default:
		return errUnknownType(job.JobType)
	}
}
