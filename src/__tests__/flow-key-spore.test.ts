import { assembleSpore, type SporeInput } from '@/lib/flow-key/spore';
import { generateSealKeyPair, verifyGenome } from '@/lib/flow-key/seal';

const { privateKeyPem, publicKeyPem } = generateSealKeyPair();

const input = (over: Partial<SporeInput> = {}): SporeInput => ({
  sporeId: 'sp1',
  sessionId: 'se1',
  boundary: '2026-07-30T22:00:00.000Z',
  generation: 0,
  parentHash: null,
  assets: [
    {
      id: 'a1',
      name: 'kick',
      created_at: '2026-07-30T21:00:00.000Z',
      upload_complete: true,
      deleted_at: null,
      digest: 'd1',
      uploader_id: 'u1',
      duration_seconds: 120,
    },
    {
      id: 'a2',
      name: 'live take',
      created_at: '2026-07-30T21:30:00.000Z',
      upload_complete: true,
      deleted_at: null,
      digest: 'd2',
      uploader_id: 'u2',
      duration_seconds: 90,
    },
  ],
  currentAssetId: 'a2',
  playbackStatus: 'playing',
  manuallyCappedIds: [],
  marks: [{ id: 'm1', event_type: 'mark', actor_id: 'u2', created_at: '2026-07-30T21:10:00.000Z' }],
  agentCredits: [{ agent_slug: 'session-spirit', actions: 2 }],
  detected: { musical_key: '8A', bpm: 138 },
  hostProfileId: 'u1',
  sealKey: { privateKeyPem, keyId: 'fk-test' },
  ...over,
});

describe('assembleSpore', () => {
  it('excludes the live take from the genome', () => {
    const doc = assembleSpore(input());
    expect(doc.capped_count).toBe(1);
    expect(doc.skipped_count).toBe(1);
    expect(JSON.stringify(doc.genome)).not.toContain('live take');
  });

  it('never embeds audio paths or URLs — digests only', () => {
    const doc = assembleSpore(input());
    const serialized = JSON.stringify(doc.genome);
    expect(serialized).toContain('d1');
    expect(serialized).not.toMatch(/storage_path|signed_url|https?:\/\//);
  });

  it('separates the carbon and silica fractions', () => {
    const doc = assembleSpore(input());
    expect(doc.genome.silica.agent_credits).toEqual([{ agent_slug: 'session-spirit', actions: 2 }]);
    expect(doc.genome.silica.detected).toEqual({ musical_key: '8A', bpm: 138 });
    expect(doc.genome.carbon.capped.map(c => c.id)).toEqual(['a1']);
  });

  it('lists every human who contributed a capped asset or a mark, plus the host', () => {
    const doc = assembleSpore(input());
    const carbon = doc.contributors.filter(c => c.fraction === 'carbon');
    expect(carbon.map(c => c.profile_id).sort()).toEqual(['u1', 'u2']);
    expect(carbon.find(c => c.profile_id === 'u1')?.role).toBe('host');
    expect(doc.contributors.find(c => c.agent_slug === 'session-spirit')?.fraction).toBe('silica');
  });

  it('produces a verifiable signature over the content hash', () => {
    const doc = assembleSpore(input());
    expect(doc.seal.algorithm).toBe('ed25519');
    expect(doc.seal.key_id).toBe('fk-test');
    expect(verifyGenome(doc.content_hash, doc.seal.signature, publicKeyPem)).toBe(true);
  });

  it('is deterministic — same input, same hash', () => {
    expect(assembleSpore(input()).content_hash).toBe(assembleSpore(input()).content_hash);
  });

  it('changes hash when a capped asset digest changes', () => {
    const mutated = input();
    mutated.assets[0].digest = 'CHANGED';
    expect(assembleSpore(mutated).content_hash).not.toBe(assembleSpore(input()).content_hash);
  });

  it('does NOT change hash when a skipped asset changes — uncapped is not harvested', () => {
    const mutated = input();
    mutated.assets[1].digest = 'CHANGED';
    expect(assembleSpore(mutated).content_hash).toBe(assembleSpore(input()).content_hash);
  });

  it('chains to a parent — a different parent_hash yields a different genome', () => {
    const child = assembleSpore(input({ generation: 1, parentHash: 'f'.repeat(64) }));
    expect(child.content_hash).not.toBe(assembleSpore(input()).content_hash);
    expect(child.genome.lineage.parent_hash).toBe('f'.repeat(64));
  });

  it('handles a spore with nothing capped', () => {
    const doc = assembleSpore(input({ assets: [], marks: [], agentCredits: [] }));
    expect(doc.capped_count).toBe(0);
    expect(doc.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
