#!/usr/bin/env node
// Backfill waveform jobs for mixes that have audio but no waveform_data.
//
// Idempotent: enqueues one pending `waveform` audio_job per missing mix, skipping
// mixes that already have a pending/processing job. The Go worker (worker/audio/)
// drains them. Safe to run repeatedly.
//
// Usage:
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backfill-waveforms.mjs
// (or: set -a; source ~/.config/mixhive/worker.env; set +a; node scripts/backfill-waveforms.mjs)

const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function rest(path, opts = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...opts,
    headers: { ...headers, ...opts.headers },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function main() {
  // Mixes with audio but no waveform yet.
  const mixes = await rest(
    'mixes?select=id&waveform_data=is.null&audio_url=not.is.null&limit=1000'
  );
  console.log(`candidate mixes missing waveform_data: ${mixes.length}`);
  if (mixes.length === 0) {
    console.log('nothing to backfill ✓');
    return;
  }

  // Existing open jobs, to avoid duplicates.
  const open = await rest(
    'audio_jobs?select=mix_id&job_type=eq.waveform&status=in.(pending,processing)'
  );
  const openSet = new Set(open.map(j => j.mix_id));

  let enqueued = 0;
  for (const m of mixes) {
    if (openSet.has(m.id)) continue;
    await rest('audio_jobs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        mix_id: m.id,
        job_type: 'waveform',
        status: 'pending',
        retry_count: 0,
        max_retries: 3,
      }),
    });
    enqueued++;
  }
  console.log(`enqueued ${enqueued} waveform job(s); ${mixes.length - enqueued} already queued`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
