#!/usr/bin/env node
// Source-agnostic demo publisher for the "AI Band" provenance bridge.
// Generates a tiny valid WAV, attaches agent-provenance metadata, and POSTs it to
// /api/mixes/publish with a user JWT — exercising ingestion end-to-end without any
// track-authoring UI. Prints the resulting /mix/:id.
//
// Usage: node scripts/provenance_publish_demo.mjs <baseURL> <jwt>
//        JWT=<token> node scripts/provenance_publish_demo.mjs http://127.0.0.1:3000

const baseURL = process.argv[2] || process.env.BASE_URL;
const jwt = process.argv[3] || process.env.JWT;
if (!baseURL || !jwt) {
  console.error('Usage: node scripts/provenance_publish_demo.mjs <baseURL> <jwt>');
  process.exit(2);
}

// Minimal 16-bit mono 8kHz WAV with a short tone so it's a real audio/* file.
function makeWav(seconds = 1, freq = 220, rate = 8000) {
  const n = seconds * rate;
  const dataLen = n * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 8000), 44 + i * 2);
  }
  return buf;
}

const metadata = {
  title: `AI Band demo — ${new Date().toISOString().slice(0, 19)}`,
  description: 'Published via the provenance demo. Co-produced with AI agents.',
  genre: 'techno',
  bpm: 132,
  key: 'A min',
  durationSecs: 1,
  tags: ['ai-band', 'demo'],
  provenance: {
    agents: [
      {
        name: 'Acid Oracle',
        role: 'Beatsmith',
        contribution: 'Generated the 303 acid line',
        model: 'fable-5',
      },
      {
        name: 'Echo Warden',
        role: 'Sound Design',
        contribution: 'Designed the reverb tails',
        model: 'opus-4-8',
      },
      {
        name: 'Groove Cartographer',
        role: 'Arrangement',
        contribution: 'Mapped the build/drop structure',
      },
    ],
  },
};

const wav = makeWav();
const form = new FormData();
form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'demo.wav');
form.append('metadata', JSON.stringify(metadata));

const res = await fetch(`${baseURL.replace(/\/$/, '')}/api/mixes/publish`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${jwt}` },
  body: form,
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Publish failed (${res.status}):`, body);
  process.exit(1);
}
console.log('Published:', body);
console.log(`Open: ${baseURL.replace(/\/$/, '')}${body.url}`);
console.log(`Agent page: ${baseURL.replace(/\/$/, '')}/ai-band/agent/acid-oracle`);
