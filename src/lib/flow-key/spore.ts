// Assembles the spore document from a session snapshot.
//
// The genome is what gets hashed and signed. It contains capped cells only, and
// per-asset content digests rather than storage paths — so the genome can be
// published for verification while the audio stays private.
import { genomeHash, type JsonValue } from './genome';
import { signGenome } from './seal';
import { selectCappedCells, type CappableAsset } from './capping';

export interface SporeAsset extends CappableAsset {
  name: string;
  digest: string;
  uploader_id: string;
  duration_seconds: number | null;
}

export interface SporeMark {
  id: string;
  event_type: string;
  actor_id: string | null;
  created_at: string;
}

export interface SporeInput {
  sporeId: string;
  sessionId: string;
  boundary: string;
  generation: number;
  parentHash: string | null;
  assets: SporeAsset[];
  currentAssetId: string | null;
  playbackStatus: 'paused' | 'playing';
  manuallyCappedIds: string[];
  marks: SporeMark[];
  /**
   * The bounded ritual agent's actions. Keyed by slug because ai_agents
   * (migration 104) is keyed by `slug text`, not a uuid.
   */
  agentCredits: Array<{ agent_slug: string; actions: number }>;
  detected: { musical_key: string | null; bpm: number | null };
  hostProfileId: string;
  sealKey: { privateKeyPem: string; keyId: string };
}

export interface Contributor {
  profile_id: string | null;
  agent_slug: string | null;
  fraction: 'carbon' | 'silica';
  role: string;
  weight: number;
}

export interface SporeGenome {
  genome_version: number;
  spore_id: string;
  session_id: string;
  boundary: string;
  lineage: { generation: number; parent_hash: string | null };
  carbon: {
    capped: Array<{
      id: string;
      name: string;
      digest: string;
      uploader_id: string;
      duration_seconds: number | null;
    }>;
    marks: Array<{ id: string; event_type: string; actor_id: string | null }>;
    contributors: string[];
  };
  silica: {
    agent_credits: Array<{ agent_slug: string; actions: number }>;
    detected: { musical_key: string | null; bpm: number | null };
  };
}

export interface SporeDocument {
  genome: SporeGenome;
  content_hash: string;
  seal: { signature: string; key_id: string; algorithm: 'ed25519' };
  contributors: Contributor[];
  capped_count: number;
  skipped_count: number;
}

export function assembleSpore(input: SporeInput): SporeDocument {
  const { capped, skipped } = selectCappedCells(input.assets, {
    boundary: input.boundary,
    currentAssetId: input.currentAssetId,
    playbackStatus: input.playbackStatus,
    manuallyCappedIds: input.manuallyCappedIds,
  });

  const marksBefore = input.marks.filter(
    m => new Date(m.created_at).getTime() <= new Date(input.boundary).getTime()
  );

  // Humans who contributed a capped cell or a mark, plus the host. Presence
  // alone is not contribution.
  const humans = new Set<string>([input.hostProfileId]);
  for (const asset of capped) humans.add(asset.uploader_id);
  for (const mark of marksBefore) if (mark.actor_id) humans.add(mark.actor_id);

  const contributors: Contributor[] = [
    ...[...humans].sort().map(profile_id => ({
      profile_id,
      agent_slug: null,
      fraction: 'carbon' as const,
      role: profile_id === input.hostProfileId ? 'host' : 'contributor',
      weight: 0,
    })),
    ...input.agentCredits.map(credit => ({
      profile_id: null,
      agent_slug: credit.agent_slug,
      fraction: 'silica' as const,
      role: 'agent',
      weight: 0,
    })),
  ];

  const genome: SporeGenome = {
    genome_version: 1,
    spore_id: input.sporeId,
    session_id: input.sessionId,
    boundary: input.boundary,
    lineage: { generation: input.generation, parent_hash: input.parentHash },
    carbon: {
      capped: capped.map(a => ({
        id: a.id,
        name: a.name,
        digest: a.digest,
        uploader_id: a.uploader_id,
        duration_seconds: a.duration_seconds,
      })),
      marks: marksBefore.map(m => ({
        id: m.id,
        event_type: m.event_type,
        actor_id: m.actor_id,
      })),
      contributors: [...humans].sort(),
    },
    silica: {
      agent_credits: input.agentCredits,
      detected: input.detected,
    },
  };

  const content_hash = genomeHash(genome as unknown as JsonValue);

  return {
    genome,
    content_hash,
    seal: {
      signature: signGenome(content_hash, input.sealKey.privateKeyPem),
      key_id: input.sealKey.keyId,
      algorithm: 'ed25519',
    },
    contributors,
    capped_count: capped.length,
    skipped_count: skipped.length,
  };
}
