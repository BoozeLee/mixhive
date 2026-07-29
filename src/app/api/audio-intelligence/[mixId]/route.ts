import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;
  return { supabaseUrl, supabaseAnonKey };
}

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42P01' || /Could not find the table/i.test(error?.message || '');
}

async function extractRawPcm(
): Promise<{ samples: Float32Array; duration: number }> {
  const outPath = filePath + '.raw';
  try {
    await new Promise<void>((resolve, reject) => {
      const ff = spawn('ffmpeg', [
        '-i', filePath,
        '-f', 's16le',
        '-acodec', 'pcm_s16le',
        '-ar', String(sampleRate),
        '-ac', '1',
        '-y', outPath,
      ]);
      ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}`))));
      ff.on('error', reject);
    });
    const buf = await fs.readFile(outPath);
    const samples = new Float32Array(buf.length / 2);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = buf.readInt16LE(i * 2) / 32768;
    }
    const duration = samples.length / sampleRate;
    return { samples, duration };
  } finally {
    try { await fs.unlink(outPath); } catch { /* best-effort */ }
  }
}

function detectBpm(samples: Float32Array, sampleRate: number): number {
  const minBpm = 60;
  const maxBpm = 200;
  const minLag = Math.floor((60 / maxBpm) * sampleRate);
  const maxLag = Math.ceil((60 / minBpm) * sampleRate);

  // Compute RMS envelope per ~23ms windows (~43 fps)
  const windowSize = Math.floor(sampleRate * 0.023);
  const envelope: number[] = [];
  for (let i = 0; i < samples.length; i += windowSize) {
    let sumSq = 0;
    let count = 0;
    for (let j = i; j < i + windowSize && j < samples.length; j++) {
      sumSq += samples[j] * samples[j];
      count++;
    }
    envelope.push(Math.sqrt(sumSq / count));
  }
  if (envelope.length < maxLag) return 0;

  // Simplifed autocorrelation on envelope
  const envLen = envelope.length;
  const mid = Math.floor(envLen / 2);
  let bestLag = 0;
  let bestScore = -Infinity;

  for (let lag = minLag; lag <= maxLag && lag < mid; lag++) {
    let score = 0;
    let count = 0;
    for (let i = 0; i + lag < mid; i++) {
      score += envelope[i] * envelope[i + lag];
      count++;
    }
    if (count > 0) {
      const mean = score / count;
      if (mean > bestScore) {
        bestScore = mean;
        bestLag = lag;
      }
    }
  }

  if (bestLag === 0) return 0;
  const envSampleRate = sampleRate / windowSize;
  const bpm = (60 * envSampleRate) / bestLag;
  return Math.round(Math.max(minBpm, Math.min(maxBpm, bpm)));
}

function estimateEnergyAndMood(
  samples: Float32Array
): { energy: number; mood: string; danceability: number } {
  let sumSq = 0;
  let peak = 0;
  let zeroCrossings = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
    if (Math.abs(samples[i]) > peak) peak = Math.abs(samples[i]);
    if (i > 0 && Math.sign(samples[i]) !== Math.sign(samples[i - 1])) zeroCrossings++;
  }
  const rms = Math.sqrt(sumSq / samples.length);
  const energy = Number(Math.min(1, rms * 10).toFixed(2));
  const zcRate = zeroCrossings / samples.length;
  const danceability = Number(Math.min(1, Math.max(0.15, zcRate * 0.8)).toFixed(2));

  let mood: string;
  if (energy < 0.3) {
    mood = (zcRate > 0.12) ? 'immersive' : 'atmospheric';
  } else if (energy < 0.6) {
    mood = (zcRate > 0.14) ? 'deep' : 'warm-groove';
  } else {
    mood = (zcRate > 0.18) ? 'high-energy' : 'underground-club';
  }

  return { energy, mood, danceability };
}

async function downloadMixFile(
  supabaseUrl: string,
  supabaseAnonKey: string,
  fileUrl: string,
  mixId: string
): Promise<string> {
  const tmpDir = '/tmp/mixhive-audio';
  await fs.mkdir(tmpDir, { recursive: true });
  const ext = path.extname(new URL(fileUrl).pathname) || '.mp3';
  const tmpPath = path.join(tmpDir, `${mixId}-${Date.now()}${ext}`);

  const resp = await fetch(fileUrl);
  if (!resp.ok) throw new Error(`Download failed: ${resp.statusText}`);
  await pipeline(resp.body as unknown as NodeJS.ReadableStream, createWriteStream(tmpPath));
  return tmpPath;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ mixId: string }> }) {
  const env = requireSupabase();
  if (!env) return NextResponse.json({ feature: null, tracks: [], setup_required: true });
  const { mixId } = await params;
  if (!UUID_RE.test(mixId)) {
    return NextResponse.json({ feature: null, tracks: [] }, { status: 404 });
  }
  const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: { persistSession: false },
  });

  const { data: feature, error } = await sb
    .from('audio_features')
    .select('*')
    .eq('mix_id', mixId)
    .maybeSingle();

  if (isMissingTable(error)) {
    return NextResponse.json({
      feature: null, tracks: [], setup_required: true,
      message: 'audio_features migration has not been applied yet.',
    });
  }
  if (error) {
    return NextResponse.json({ feature: null, tracks: [] }, { status: 404 });
  }

  const { data: tracks, error: tracksError } = await sb
    .from('mix_tracks')
    .select('*')
    .eq('mix_id', mixId)
    .order('start_sec', { ascending: true });

  if (tracksError && tracksError.code !== '42P01') {
    return NextResponse.json({ feature, tracks: [] });
  }

  return NextResponse.json({ feature, tracks: tracks ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ mixId: string }> }) {
  const env = requireSupabase();
  if (!env) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { mixId } = await params;
  const jwt = authHeader.slice(7);
  const sb = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { data: mix, error: mixError } = await sb
    .from('mixes')
    .select('id, dj_id, title, description, tags, duration_seconds, file_url')
    .eq('id', mixId)
    .single();

  if (mixError || !mix) return NextResponse.json({ error: 'Mix not found' }, { status: 404 });
  if (mix.dj_id !== user.id)
    return NextResponse.json({ error: 'Only the mix owner can analyze this mix' }, { status: 403 });

  // Upsert processing status immediately
  const { error: upsertError } = await sb
    .from('audio_features')
    .upsert(
      {
        mix_id: mix.id,
        status: 'processing',
        source: 'mixhive-ffmpeg-v1',
        model: 'ffmpeg-extraction-v1',
      },
      { onConflict: 'mix_id' }
    );
  if (upsertError && !isMissingTable(upsertError)) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  try {
    let bpm: number | null = null;
    let energy = 0.5;
    let mood = 'underground-club';
    let danceability: number | null = null;
    let errorMessage: string | null = null;

    if (mix.file_url) {
      let tmpPath: string | null = null;
      try {
        tmpPath = await downloadMixFile(env.supabaseUrl, env.supabaseAnonKey, mix.file_url, mix.id);

        // Extract PCM and detect BPM / energy
        const sampleRate = 22050;
        const { samples } = await extractRawPcm(tmpPath, sampleRate);

        bpm = detectBpm(samples, sampleRate);
        const e = estimateEnergyAndMood(samples);
        energy = e.energy;
        mood = e.mood;
        danceability = e.danceability;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : 'Unknown processing error';
      } finally {
        if (tmpPath) try { await fs.unlink(tmpPath); } catch { /* best-effort */ }
      }
    }

    const payload = {
      mix_id: mix.id,
      status: errorMessage ? 'failed' : 'complete',
      bpm,
      musical_key: null,
      camelot: null,
      mood,
      energy,
      danceability,
      structure_json: {},
      source: 'mixhive-ffmpeg-v1',
      model: 'ffmpeg-extraction-v1',
      confidence: bpm ? 0.75 : null,
      error_message: errorMessage,
    };

    const { data: feature, error: writeError } = await sb
      .from('audio_features')
      .upsert(payload, { onConflict: 'mix_id' })
      .select()
      .single();

    if (isMissingTable(writeError)) {
      return NextResponse.json(
        { error: 'audio_intelligence_storage_not_ready', message: 'Run Supabase migrations before storing audio analysis.' },
        { status: 503 }
      );
    }
    if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

    return NextResponse.json({ feature, tracks: [] });
  } catch (err) {
    // Mark failed on unexpected error
    await sb.from('audio_features').upsert(
      {
        mix_id: mix.id,
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unexpected error',
        source: 'mixhive-ffmpeg-v1',
      },
      { onConflict: 'mix_id' }
    );
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
