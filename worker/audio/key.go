package main

import "math"

// Musical-key detection via a chroma vector + Krumhansl–Schmuckler key profiles.
// Stdlib-only (matches the worker's no-deps constraint): a Goertzel filter pulls
// the energy at each pitch-class frequency across octaves, folded into 12 bins.

var noteNames = [12]string{"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"}

// Krumhansl–Schmuckler tone profiles (major / natural minor), tonic at index 0.
var ksMajor = [12]float64{6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88}
var ksMinor = [12]float64{6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17}

const (
	chromaFrame     = 4096
	chromaHop       = 2048
	chromaLoMidi    = 36 // C2
	chromaHiMidi    = 95 // B6 (well under the 4 kHz Nyquist of the 8 kHz decode)
	chromaMaxFrames = 400
)

// chromaVector accumulates pitch-class energy across the signal, normalized so
// the bins sum to 1. Returns the zero vector for silence.
func chromaVector(samples []float64, fs int) [12]float64 {
	var chroma [12]float64
	if len(samples) < chromaFrame || fs <= 0 {
		return chroma
	}
	// Precompute target frequencies + their pitch class.
	type target struct {
		freq float64
		pc   int
	}
	var targets []target
	for midi := chromaLoMidi; midi <= chromaHiMidi; midi++ {
		f := 440.0 * math.Pow(2, float64(midi-69)/12.0)
		if f >= float64(fs)/2 {
			break
		}
		targets = append(targets, target{freq: f, pc: ((midi % 12) + 12) % 12})
	}
	// Hann window (precomputed).
	win := make([]float64, chromaFrame)
	for i := range win {
		win[i] = 0.5 - 0.5*math.Cos(2*math.Pi*float64(i)/float64(chromaFrame-1))
	}

	frames := 0
	for start := 0; start+chromaFrame <= len(samples) && frames < chromaMaxFrames; start += chromaHop {
		frame := samples[start : start+chromaFrame]
		for _, t := range targets {
			chroma[t.pc] += goertzel(frame, win, t.freq, float64(fs))
		}
		frames++
	}

	var sum float64
	for _, v := range chroma {
		sum += v
	}
	if sum <= 0 {
		return [12]float64{}
	}
	for i := range chroma {
		chroma[i] /= sum
	}
	return chroma
}

// goertzel returns the magnitude of a single frequency in a windowed frame.
func goertzel(frame, win []float64, freq, fs float64) float64 {
	coeff := 2 * math.Cos(2*math.Pi*freq/fs)
	var s0, s1, s2 float64
	for i, x := range frame {
		s0 = x*win[i] + coeff*s1 - s2
		s2 = s1
		s1 = s0
	}
	power := s1*s1 + s2*s2 - coeff*s1*s2
	if power < 0 {
		power = 0
	}
	return math.Sqrt(power)
}

// dominantPitchClass returns the index of the strongest chroma bin (-1 if empty).
func dominantPitchClass(chroma [12]float64) int {
	best, bestVal := -1, 0.0
	for i, v := range chroma {
		if v > bestVal {
			bestVal, best = v, i
		}
	}
	return best
}

// detectKey returns the best-matching key as e.g. "A min" / "C maj", or "" when
// the signal carries no usable pitch content.
func detectKey(samples []float64, fs int) string {
	chroma := chromaVector(samples, fs)
	if dominantPitchClass(chroma) < 0 {
		return ""
	}
	bestCorr := math.Inf(-1)
	bestTonic, bestMinor := 0, false
	for tonic := 0; tonic < 12; tonic++ {
		maj := correlateRotated(chroma, ksMajor, tonic)
		if maj > bestCorr {
			bestCorr, bestTonic, bestMinor = maj, tonic, false
		}
		min := correlateRotated(chroma, ksMinor, tonic)
		if min > bestCorr {
			bestCorr, bestTonic, bestMinor = min, tonic, true
		}
	}
	mode := "maj"
	if bestMinor {
		mode = "min"
	}
	return noteNames[bestTonic] + " " + mode
}

// correlateRotated is the Pearson correlation between the chroma and a key
// profile rotated so its tonic sits at `tonic`.
func correlateRotated(chroma [12]float64, profile [12]float64, tonic int) float64 {
	var rot [12]float64
	for i := 0; i < 12; i++ {
		rot[i] = profile[((i-tonic)%12+12)%12]
	}
	return pearson(chroma[:], rot[:])
}

// nullIfEmpty returns nil for an empty string so JSON serializes it as null.
func nullIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func pearson(a, b []float64) float64 {
	n := float64(len(a))
	var ma, mb float64
	for i := range a {
		ma += a[i]
		mb += b[i]
	}
	ma /= n
	mb /= n
	var num, da, db float64
	for i := range a {
		x, y := a[i]-ma, b[i]-mb
		num += x * y
		da += x * x
		db += y * y
	}
	if da == 0 || db == 0 {
		return 0
	}
	return num / math.Sqrt(da*db)
}
