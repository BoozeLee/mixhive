package main

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config is the worker's runtime configuration, all from environment variables.
type Config struct {
	SupabaseURL     string
	ServiceRoleKey  string
	AudioBucket     string
	PollInterval    time.Duration
	MaxConcurrent   int
	JobTimeout      time.Duration
	WaveformPoints  int
	TempDir         string
}

func loadConfig() (*Config, error) {
	url := os.Getenv("SUPABASE_URL")
	if url == "" {
		url = os.Getenv("NEXT_PUBLIC_SUPABASE_URL")
	}
	key := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
	if url == "" || key == "" {
		return nil, fmt.Errorf("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
	}

	cfg := &Config{
		SupabaseURL:    trimTrailingSlash(url),
		ServiceRoleKey: key,
		AudioBucket:    envOr("AUDIO_BUCKET", "mix-audio"),
		PollInterval:   time.Duration(envInt("POLL_INTERVAL_MS", 5000)) * time.Millisecond,
		MaxConcurrent:  envInt("MAX_CONCURRENT", 3),
		JobTimeout:     time.Duration(envInt("JOB_TIMEOUT_MS", 300000)) * time.Millisecond,
		WaveformPoints: envInt("WAVEFORM_POINTS", 200),
		TempDir:        envOr("TEMP_DIR", "/tmp/mixhive-audio"),
	}
	if cfg.MaxConcurrent < 1 {
		cfg.MaxConcurrent = 1
	}
	if cfg.WaveformPoints < 16 {
		cfg.WaveformPoints = 16
	}
	return cfg, nil
}

func envOr(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func envInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func trimTrailingSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}
