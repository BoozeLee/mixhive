package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// Supabase is a tiny PostgREST + Storage client over the service-role key.
// Stdlib only — no external deps, so the worker compiles and runs anywhere.
type Supabase struct {
	baseURL string
	key     string
	http    *http.Client
}

func newSupabase(cfg *Config) *Supabase {
	return &Supabase{
		baseURL: cfg.SupabaseURL,
		key:     cfg.ServiceRoleKey,
		http:    &http.Client{Timeout: 60 * time.Second},
	}
}

func (s *Supabase) auth(req *http.Request) {
	req.Header.Set("apikey", s.key)
	req.Header.Set("Authorization", "Bearer "+s.key)
}

// AudioJob mirrors the public.audio_jobs row.
type AudioJob struct {
	ID         string `json:"id"`
	MixID      string `json:"mix_id"`
	JobType    string `json:"job_type"`
	Status     string `json:"status"`
	RetryCount int    `json:"retry_count"`
	MaxRetries int    `json:"max_retries"`
}

// claimNextJob atomically moves one pending job to 'processing' and returns it.
// PostgREST applies the WHERE filter and RETURNS the updated row, so two workers
// racing on the same row can't both win (the second sees status already changed).
func (s *Supabase) claimNextJob(ctx context.Context) (*AudioJob, error) {
	// First, find a candidate pending job id (oldest first).
	q := url.Values{}
	q.Set("select", "id")
	q.Set("status", "eq.pending")
	q.Set("order", "created_at.asc")
	q.Set("limit", "1")
	var found []struct {
		ID string `json:"id"`
	}
	if err := s.getJSON(ctx, "/rest/v1/audio_jobs?"+q.Encode(), &found); err != nil {
		return nil, err
	}
	if len(found) == 0 {
		return nil, nil
	}
	id := found[0].ID

	// Atomically claim it: update ... where id=? and status=pending, returning row.
	body, _ := json.Marshal(map[string]any{
		"status":     "processing",
		"started_at": time.Now().UTC().Format(time.RFC3339),
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	})
	cq := url.Values{}
	cq.Set("id", "eq."+id)
	cq.Set("status", "eq.pending")
	cq.Set("select", "id,mix_id,job_type,status,retry_count,max_retries")
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch,
		s.baseURL+"/rest/v1/audio_jobs?"+cq.Encode(), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	s.auth(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("claim failed: %s: %s", resp.Status, string(b))
	}
	var claimed []AudioJob
	if err := json.NewDecoder(resp.Body).Decode(&claimed); err != nil {
		return nil, err
	}
	if len(claimed) == 0 {
		// Lost the race to another worker; caller retries.
		return nil, nil
	}
	return &claimed[0], nil
}

// Mix holds the fields the worker needs.
type Mix struct {
	AudioURL string `json:"audio_url"`
	Title    string `json:"title"`
}

func (s *Supabase) getMix(ctx context.Context, mixID string) (*Mix, error) {
	q := url.Values{}
	q.Set("select", "audio_url,title")
	q.Set("id", "eq."+mixID)
	q.Set("limit", "1")
	var rows []Mix
	if err := s.getJSON(ctx, "/rest/v1/mixes?"+q.Encode(), &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("mix %s not found", mixID)
	}
	return &rows[0], nil
}

func (s *Supabase) patch(ctx context.Context, path string, body any) error {
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPatch, s.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	s.auth(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=minimal")
	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		bb, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("patch %s: %s: %s", path, resp.Status, string(bb))
	}
	return nil
}

// updateMix writes computed fields back onto the mixes row.
func (s *Supabase) updateMix(ctx context.Context, mixID string, fields map[string]any) error {
	fields["updated_at"] = time.Now().UTC().Format(time.RFC3339)
	return s.patch(ctx, "/rest/v1/mixes?id=eq."+url.QueryEscape(mixID), fields)
}

func (s *Supabase) completeJob(ctx context.Context, jobID string, result map[string]any) error {
	return s.patch(ctx, "/rest/v1/audio_jobs?id=eq."+url.QueryEscape(jobID), map[string]any{
		"status":       "complete",
		"result":       result,
		"completed_at": time.Now().UTC().Format(time.RFC3339),
		"updated_at":   time.Now().UTC().Format(time.RFC3339),
	})
}

// failJob marks failed; if retries remain it goes back to 'pending' for re-pickup.
func (s *Supabase) failJob(ctx context.Context, job *AudioJob, msg string) error {
	status := "failed"
	if job.RetryCount < job.MaxRetries {
		status = "pending"
	}
	return s.patch(ctx, "/rest/v1/audio_jobs?id=eq."+url.QueryEscape(job.ID), map[string]any{
		"status":        status,
		"error_message": msg,
		"retry_count":   job.RetryCount + 1,
		"updated_at":    time.Now().UTC().Format(time.RFC3339),
	})
}

// upsertAudioFeatures writes the computed bpm/energy/mood/key to the
// audio_features table, keyed by mix_id (on_conflict merge). Best-effort —
// failures are logged, not fatal.
func (s *Supabase) upsertAudioFeatures(ctx context.Context, mixID string, a *AudioAnalysis) error {
	row := map[string]any{
		"mix_id":     mixID,
		"status":     "complete",
		"mood":       a.Mood,
		"energy":     a.Energy,
		"source":     "go-worker",
		"model":      "ffmpeg-autocorr-chroma-v2",
		"updated_at": time.Now().UTC().Format(time.RFC3339),
	}
	if a.BPM > 0 {
		row["bpm"] = a.BPM
	}
	if a.Key != "" {
		row["musical_key"] = a.Key
	}
	b, _ := json.Marshal(row)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		s.baseURL+"/rest/v1/audio_features?on_conflict=mix_id", bytes.NewReader(b))
	if err != nil {
		return err
	}
	s.auth(req)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates,return=minimal")
	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		bb, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("audio_features upsert: %s: %s", resp.Status, string(bb))
	}
	return nil
}

// download fetches a (public or signed) URL to dst.
func (s *Supabase) download(ctx context.Context, rawURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	// If it's a Supabase storage path behind auth, the service key authorizes it.
	s.auth(req)
	resp, err := s.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download %s: %s", rawURL, resp.Status)
	}
	return io.ReadAll(resp.Body)
}

func (s *Supabase) getJSON(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.baseURL+path, nil)
	if err != nil {
		return err
	}
	s.auth(req)
	req.Header.Set("Accept", "application/json")
	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("GET %s: %s: %s", path, resp.Status, string(b))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
