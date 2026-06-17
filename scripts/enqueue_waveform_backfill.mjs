#!/usr/bin/env node
// Backfill: enqueue an audio analysis job for every mix missing `waveform_data`,
// so the Go audio worker computes waveform + duration + bpm + key + mood for the
// existing catalog. Uses the dedup-aware `enqueue_audio_job` RPC (skips mixes that
// already have a pending/processing job).
//
// Service-role required (writes the queue). DRY-RUN by default; pass --commit to
// actually enqueue.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/enqueue_waveform_backfill.mjs [--commit] [--job-type bpm_key_mood]

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}
const commit = process.argv.includes('--commit');
const jtIdx = process.argv.indexOf('--job-type');
const jobType = jtIdx >= 0 ? process.argv[jtIdx + 1] : 'bpm_key_mood';

const sb = createClient(url, key, { auth: { persistSession: false } });

const PAGE = 1000;
let from = 0;
const targets = [];
for (;;) {
  const { data, error } = await sb
    .from('mixes')
    .select('id, title, waveform_data')
    .is('waveform_data', null)
    .order('created_at', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('query failed:', error.message);
    process.exit(1);
  }
  if (!data || data.length === 0) break;
  targets.push(...data);
  if (data.length < PAGE) break;
  from += PAGE;
}

console.log(`Mixes missing waveform_data: ${targets.length} (job_type=${jobType})`);
if (!commit) {
  console.log('DRY-RUN — pass --commit to enqueue. Sample:');
  for (const m of targets.slice(0, 10)) console.log(`  ${m.id}  ${m.title ?? ''}`);
  process.exit(0);
}

let queued = 0;
let skipped = 0;
let failed = 0;
for (const m of targets) {
  const { data: jobId, error } = await sb.rpc('enqueue_audio_job', {
    p_mix_id: m.id,
    p_job_type: jobType,
  });
  if (error) {
    failed++;
    console.error(`  ${m.id}: ${error.message}`);
  } else if (jobId) {
    queued++;
  } else {
    skipped++; // already had a pending/processing job
  }
}
console.log(`Done. queued=${queued} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
