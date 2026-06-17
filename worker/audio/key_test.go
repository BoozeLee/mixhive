package main

import (
	"math"
	"testing"
)

const testFS = 8000

// tone synthesizes `secs` of a sine at `freq` Hz at the worker's decode rate.
func tone(freq float64, secs float64) []float64 {
	n := int(float64(testFS) * secs)
	s := make([]float64, n)
	for i := range s {
		s[i] = 0.6 * math.Sin(2*math.Pi*freq*float64(i)/testFS)
	}
	return s
}

// mix sums several tones (a crude chord).
func mix(secs float64, freqs ...float64) []float64 {
	n := int(float64(testFS) * secs)
	s := make([]float64, n)
	for _, f := range freqs {
		t := tone(f, secs)
		for i := range s {
			s[i] += t[i] / float64(len(freqs))
		}
	}
	return s
}

func TestChromaDominantPitchClass(t *testing.T) {
	cases := []struct {
		name string
		freq float64
		pc   int // expected pitch class (C=0 .. B=11)
	}{
		{"A4=440", 440, 9},
		{"C4=261.63", 261.63, 0},
		{"E4=329.63", 329.63, 4},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := dominantPitchClass(chromaVector(tone(c.freq, 2), testFS))
			if got != c.pc {
				t.Fatalf("dominant pitch class = %d (%s), want %d", got, noteNames[got], c.pc)
			}
		})
	}
}

func TestDetectKeyCMajorTriad(t *testing.T) {
	// C major triad (C4, E4, G4). KS should resolve to C maj or its relative A min.
	key := detectKey(mix(3, 261.63, 329.63, 392.0), testFS)
	if key != "C maj" && key != "A min" {
		t.Fatalf("detectKey(C-E-G) = %q, want C maj or A min", key)
	}
}

func TestDetectKeySilenceEmpty(t *testing.T) {
	if got := detectKey(make([]float64, testFS*2), testFS); got != "" {
		t.Fatalf("detectKey(silence) = %q, want empty", got)
	}
}
