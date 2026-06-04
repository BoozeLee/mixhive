package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"
)

var errEmptyAudio = errors.New("mix has no audio_url")

func errUnknownType(t string) error {
	return fmt.Errorf("unknown job_type %q", t)
}

// runSelfTest decodes a local audio file and prints the analysis. No network,
// no Supabase — proves the ffmpeg pipeline works end to end.
func runSelfTest(path string) {
	audio, err := os.ReadFile(path)
	if err != nil {
		fmt.Printf("selftest: read %s: %v\n", path, err)
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	a, err := analyze(ctx, audio, 200)
	if err != nil {
		fmt.Printf("selftest: analyze: %v\n", err)
		os.Exit(1)
	}
	// Print a compact summary + a few sample peaks.
	fmt.Printf("selftest OK: duration=%.2fs points=%d\n", a.DurationSec, len(a.Peaks))
	fmt.Printf("first 8 peaks: %v\n", a.Peaks[:8])
	var sum float64
	for _, p := range a.Peaks {
		sum += p
	}
	fmt.Printf("mean peak=%.3f\n", sum/float64(len(a.Peaks)))
}
