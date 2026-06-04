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
}

// analyze decodes audio bytes with ffmpeg and computes a normalized peak array
// (the real waveform that nothing in the app currently produces) plus duration.
// ffmpeg reads from stdin, decodes to mono 8kHz s16le PCM on stdout.
func analyze(ctx context.Context, audio []byte, points int) (*AudioAnalysis, error) {
	dur, _ := probeDuration(ctx, audio)

	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-hide_banner", "-loglevel", "error",
		"-i", "pipe:0",
		"-ac", "1", "-ar", "8000",
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
			s := int16(binary.LittleEndian.Uint16(pcm[i*2:]))
			a := math.Abs(float64(s)) / 32768.0
			if a > maxAbs {
				maxAbs = a
			}
		}
		peaks[p] = round3(maxAbs)
	}

	// If ffprobe couldn't read duration, derive it from sample count (8kHz mono).
	if dur <= 0 {
		dur = float64(n) / 8000.0
	}

	return &AudioAnalysis{Peaks: peaks, DurationSec: round3(dur)}, nil
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
