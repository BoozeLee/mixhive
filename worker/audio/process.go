package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"os/exec"
	"strconv"
	"strings"
)

// AudioAnalysis is the computed result of decoding one audio file.
type AudioAnalysis struct {
	Peaks       []float64 // normalized 0..1, len == WaveformPoints
	DurationSec float64
	BPM         float64 // autocorrelation tempo estimate (0 if undetectable)
	Energy      float64 // mean loudness 0..1
	Mood        string  // peak | groove | ambient | transition
}

const decodeSampleRate = 8000 // mono decode rate used for waveform + tempo

// analyze decodes audio bytes with ffmpeg to mono 8kHz s16le PCM, then computes:
//   - a normalized 200-point waveform peak array
//   - duration
//   - BPM (autocorrelation of an onset/energy envelope)
//   - energy (mean RMS loudness) and a derived mood bucket
func analyze(ctx context.Context, audio []byte, points int) (*AudioAnalysis, error) {
	dur, _ := probeDuration(ctx, audio)

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", "pipe:0",
		"-ac", "1", "-ar", strconv.Itoa(decodeSampleRate),
		"-f", "s16le", "pipe:1",
	)
	cmd.Stdin = bytes.NewReader(audio)
	var out bytes.Buffer
	var errb bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errb
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg decode: %v: %s", err, strings.TrimSpace(errb.String()))
	}

	pcm := out.Bytes()
	n := len(pcm) / 2 // int16 samples
	if n == 0 {
		return nil, fmt.Errorf("no audio samples decoded")
	}

	// decode samples once into float -1..1
	samples := make([]float64, n)
	for i := 0; i < n; i++ {
		samples[i] = float64(int16(binary.LittleEndian.Uint16(pcm[i*2:]))) / 32768.0
	}

	// ── Waveform peaks ─────────────────────────────────────────────
	peaks := make([]float64, points)
	bucket := n / points
	if bucket < 1 {
		bucket = 1
	}
	for p := 0; p < points; p++ {
		start := p * bucket
		end := start + bucket
		if end > n {
			end = n
		}
		var maxAbs float64
		for i := start; i < end; i++ {
			a := math.Abs(samples[i])
			if a > maxAbs {
				maxAbs = a
			}
		}
		peaks[p] = round3(maxAbs)
	}

	if dur <= 0 {
		dur = float64(n) / decodeSampleRate
	}

	bpm, energy := tempoAndEnergy(samples)
	mood := classifyMood(bpm, energy)

	return &AudioAnalysis{
		Peaks:       peaks,
		DurationSec: round3(dur),
		BPM:         bpm,
		Energy:      round3(energy),
		Mood:        mood,
	}, nil
}

// tempoAndEnergy builds a per-hop onset-strength envelope (half-wave-rectified
// RMS flux) and autocorrelates it to estimate tempo, plus the overall loudness.
// Returns bpm (rounded to 0.5, 0 if undetectable) and energy 0..1.
func tempoAndEnergy(samples []float64) (bpm, energy float64) {
	const hop = 256 // ~31.25 fps at 8kHz
	frames := len(samples) / hop
	if frames < 8 {
		return 0, rms(samples)
	}
	fps := float64(decodeSampleRate) / float64(hop)

	// per-frame RMS
	frameRMS := make([]float64, frames)
	for f := 0; f < frames; f++ {
		seg := samples[f*hop : f*hop+hop]
		frameRMS[f] = rms(seg)
	}

	// onset strength = positive flux of RMS, mean-removed
	onset := make([]float64, frames)
	var omean float64
	for f := 1; f < frames; f++ {
		d := frameRMS[f] - frameRMS[f-1]
		if d > 0 {
			onset[f] = d
		}
		omean += onset[f]
	}
	omean /= float64(frames)
	for f := range onset {
		onset[f] -= omean
	}

	// autocorrelation over lags for BPM in [60,180]
	minLag := int(math.Round(fps * 60.0 / 180.0)) // fastest
	maxLag := int(math.Round(fps * 60.0 / 60.0))  // slowest
	if minLag < 1 {
		minLag = 1
	}
	if maxLag >= frames {
		maxLag = frames - 1
	}
	corr := make([]float64, maxLag+1)
	bestLag, bestCorr := 0, 0.0
	for lag := minLag; lag <= maxLag; lag++ {
		var c float64
		for f := lag; f < frames; f++ {
			c += onset[f] * onset[f-lag]
		}
		corr[lag] = c
		if c > bestCorr {
			bestCorr = c
			bestLag = lag
		}
	}
	if bestLag > 0 && bestCorr > 0 {
		// Parabolic interpolation around the peak for sub-lag (sub-BPM) accuracy.
		lag := float64(bestLag)
		if bestLag > minLag && bestLag < maxLag {
			a0, a1, a2 := corr[bestLag-1], corr[bestLag], corr[bestLag+1]
			denom := a0 - 2*a1 + a2
			if denom != 0 {
				lag += 0.5 * (a0 - a2) / denom
			}
		}
		bpm = 60.0 * fps / lag
		bpm = math.Round(bpm*10) / 10 // nearest 0.1
	}
	return bpm, rms(samples)
}

func rms(s []float64) float64 {
	if len(s) == 0 {
		return 0
	}
	var sum float64
	for _, v := range s {
		sum += v * v
	}
	return math.Sqrt(sum / float64(len(s)))
}

// classifyMood buckets a track into the app's mood vocabulary from tempo + energy.
func classifyMood(bpm, energy float64) string {
	switch {
	case bpm == 0:
		return "ambient"
	case energy >= 0.22 && bpm >= 126:
		return "peak"
	case bpm >= 110:
		return "groove"
	case bpm < 100 && energy < 0.12:
		return "ambient"
	default:
		return "transition"
	}
}

// probeDuration runs ffprobe on the bytes via stdin to read container duration.
func probeDuration(ctx context.Context, audio []byte) (float64, error) {
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-hide_banner", "-loglevel", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		"-i", "pipe:0",
	)
	cmd.Stdin = bytes.NewReader(audio)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return 0, err
	}
	d, err := strconv.ParseFloat(strings.TrimSpace(out.String()), 64)
	if err != nil {
		return 0, err
	}
	return d, nil
}

func round3(f float64) float64 {
	return math.Round(f*1000) / 1000
}
