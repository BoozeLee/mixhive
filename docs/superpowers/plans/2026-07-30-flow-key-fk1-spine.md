# Flow Key FK-1 (Spine) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host can turn the Flow Key mid-ritual and drain the session's *capped* material into a durable, self-verifying spore, without pausing the session or opening a modal.

**Architecture:** A per-session drain lock (`flow_key_taps`) guarded by a security-definer RPC guarantees one drain at a time. The capped-cell predicate is pure TypeScript (jest-testable) rather than SQL, since this repo has jest and no pgTAP. Sealing canonicalizes the spore body with RFC 8785 JCS, hashes it with sha256 (`content_hash` = the genome), signs that with Ed25519 from `node:crypto`, and stores the document in a private bucket. Verification needs no chain, no wallet, and no database — only the genome, the signature, and the public key served from `.well-known`.

**Tech Stack:** Next.js 16 App Router route handlers, Supabase Postgres + RLS + Storage, `node:crypto` (Ed25519 + sha256, zero new dependencies), jest + `jest-environment-jsdom` (node env per-file for route tests), React 19, TypeScript 6 strict.

**Spec:** `docs/superpowers/specs/2026-07-30-flow-key-design.md` (§5–§8, §9 Layer A, §10–§12)

## Global Constraints

- **Migration number is 119.** Highest existing is 118. Never edit an existing migration. Idempotent (`if not exists` / `drop … if exists` before `create`), wrapped in `begin; … commit;`.
- **`mythic_edges` and `mythic_nodes` have SELECT-only RLS.** Every edge/node write goes through a `security definer` RPC. Pattern: `supabase/migrations/096_causal_career_loop.sql`.
- **Never `key` as a bare identifier.** `key` means *musical* key in this codebase (`src/components/KeyChip.tsx`). Use `flow_key_*`, `flow_spore_*`, `FlowKey*`, `Spore*`.
- **The word "NFT" appears nowhere.** FK-1 adds no chain code and touches neither `nft_collections` nor `nft_tokens`.
- **No new npm dependencies.** Ed25519 and sha256 come from `node:crypto`. JCS is hand-written (~30 lines).
- **No raw hex colours.** Use `src/styles/tokens.ts`. ESLint enforces this (P1 sweep, commit `1128c01`).
- **Buttons are real `<button>` elements.** No `confirm()` anywhere in the turn path — Experiment 1 deliberately eliminated them from this flow.
- **320px stable, no horizontal overflow. Respect `prefers-reduced-motion`.**
- **Audio never enters the genome.** Only per-asset content digests.
- **Codex owns `vercel.json`, `next.config.mjs`, `src/app/*` infra and `.github/workflows/*`.** Task 12 is a written handoff, not a patch. (`CLAUDE.md` → Agent Ownership.)
- Verification order before handoff: `npx tsc --noEmit` · `npm run lint` · `npm test` · `npm run build`.
- Test files: `src/__tests__/<kebab-name>.test.ts(x)`. Route tests need `/** @jest-environment node */` as the first line.

## Deviations from the spec (deliberate, with reasons)

1. **The capping predicate is TypeScript, not SQL.** The spec (§7 RPC 1) has `turn_flow_key` compute the capped set. Implemented that way it would be untestable — this repo has jest and no pgTAP, and duplicating the predicate in both SQL and TS would be a bug farm. So: `turn_flow_key` performs **only** the atomic lock, and the route computes the capped set in TS before calling it. The residual race (an asset uploaded between check and turn) is harmless — the boundary is `tap.opened_at` and the seal records the true `capped_count`.
2. **`FlowKeyGlyph` does not reuse `HexCell`.** The spec (§10) says reuse it; the actual component is a track-card (`BpmChip`, `WaveformAccent`, title/artist/bpm props, min 64×74). Wrong shape for a 28px status glyph. FK-1 draws its own inline SVG hexagon and shares only the token palette.
3. **`RitualAsset` gains `created_at`.** The glyph needs the capped/uncapped count, which the boundary comparison requires. Additive, non-breaking.

---

### Task 1: JCS canonicalization + genome hash

**Files:**
- Create: `src/lib/flow-key/genome.ts`
- Test: `src/__tests__/flow-key-genome.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `canonicalize(value: JsonValue): string`, `genomeHash(body: JsonValue): string` (64-char lowercase hex), `type JsonValue`.

- [ ] **Step 1: Write the failing test**

```ts
import { canonicalize, genomeHash } from '@/lib/flow-key/genome';

describe('canonicalize (RFC 8785 subset)', () => {
  it('sorts object keys lexicographically', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('is independent of insertion order, at every depth', () => {
    const a = canonicalize({ z: { y: 1, x: 2 }, a: [1, 2] });
    const b = canonicalize({ a: [1, 2], z: { x: 2, y: 1 } });
    expect(a).toBe(b);
  });

  it('preserves array order', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });

  it('emits no insignificant whitespace', () => {
    expect(canonicalize({ a: [1, { b: 2 }] })).toBe('{"a":[1,{"b":2}]}');
  });

  it('normalizes integral floats to integers', () => {
    expect(canonicalize({ n: 1.0 })).toBe('{"n":1}');
  });

  it('serializes null but drops undefined members', () => {
    expect(canonicalize({ a: null, b: undefined })).toBe('{"a":null}');
  });

  it('escapes control characters and keeps non-ASCII literal', () => {
    expect(canonicalize({ s: 'a\nb' })).toBe('{"s":"a\\nb"}');
    expect(canonicalize({ s: 'techno ✦' })).toBe('{"s":"techno ✦"}');
  });

  it('rejects non-finite numbers rather than emitting invalid JSON', () => {
    expect(() => canonicalize({ n: NaN })).toThrow(/finite/i);
    expect(() => canonicalize({ n: Infinity })).toThrow(/finite/i);
  });
});

describe('genomeHash', () => {
  const body = { session_id: 's1', capped: [{ digest: 'aa', name: 'kick' }] };

  it('is a deterministic 64-char lowercase hex digest', () => {
    expect(genomeHash(body)).toBe(genomeHash(body));
    expect(genomeHash(body)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is unchanged by key reordering', () => {
    expect(genomeHash({ a: 1, b: 2 })).toBe(genomeHash({ b: 2, a: 1 }));
  });

  it('changes when any asset digest changes', () => {
    const mutated = { session_id: 's1', capped: [{ digest: 'ab', name: 'kick' }] };
    expect(genomeHash(mutated)).not.toBe(genomeHash(body));
  });

  it('changes when parent_hash changes (hash-chain integrity)', () => {
    const gen0 = genomeHash({ ...body, parent_hash: null });
    const gen1 = genomeHash({ ...body, parent_hash: 'f'.repeat(64) });
    expect(gen1).not.toBe(gen0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-genome.test.ts`
Expected: FAIL — `Cannot find module '@/lib/flow-key/genome'`

- [ ] **Step 3: Write minimal implementation**

```ts
// RFC 8785 (JSON Canonicalization Scheme) — the subset the Flow Key genome needs.
// Canonical bytes must be byte-identical across runtimes, because the genome hash
// is the spore's identity and is verified offline by third parties.
import { createHash } from 'node:crypto';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

function serializeString(value: string): string {
  // JSON.stringify already emits RFC 8785-compatible escaping: the shortest
  // form, lowercase \uXXXX for control chars, and literal non-ASCII (UTF-8).
  return JSON.stringify(value);
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot canonicalize non-finite number: ${String(value)}`);
  }
  // JCS uses ECMAScript Number::toString, which already collapses 1.0 -> "1".
  return String(value);
}

export function canonicalize(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return serializeNumber(value);
  if (typeof value === 'string') return serializeString(value);

  if (Array.isArray(value)) {
    // Array order is significant and preserved; undefined members become null,
    // matching JSON.stringify.
    return `[${value.map(item => (item === undefined ? 'null' : canonicalize(item))).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .filter(k => value[k] !== undefined)
      .map(k => `${serializeString(k)}:${canonicalize(value[k])}`);
    return `{${entries.join(',')}}`;
  }

  throw new Error(`Cannot canonicalize value of type ${typeof value}`);
}

/** sha256 over the canonical bytes. This digest IS the spore's genome. */
export function genomeHash(body: JsonValue): string {
  return createHash('sha256').update(canonicalize(body), 'utf8').digest('hex');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-genome.test.ts`
Expected: PASS (14 assertions across 12 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow-key/genome.ts src/__tests__/flow-key-genome.test.ts
git commit -m "feat(flow-key): JCS canonicalization + genome hash"
```

---

### Task 2: Ed25519 seal, verification, and key loading

**Files:**
- Create: `src/lib/flow-key/seal.ts`
- Test: `src/__tests__/flow-key-seal.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (operates on the hex digest string).
- Produces: `signGenome(contentHash: string, privateKeyPem: string): string` (base64url), `verifyGenome(contentHash: string, signature: string, publicKeyPem: string): boolean`, `loadSealKey(): { privateKeyPem: string; publicKeyPem: string; keyId: string }`, `loadVerificationKeys(): Array<{ keyId: string; publicKeyPem: string }>`, `generateSealKeyPair(): { privateKeyPem: string; publicKeyPem: string }`.

Env: `FLOW_KEY_SEAL_KEY` (PEM PKCS#8 private key, server-only), `FLOW_KEY_SEAL_KEY_ID` (e.g. `fk-2026-07`), `FLOW_KEY_SEAL_KEY_PREVIOUS` + `FLOW_KEY_SEAL_KEY_PREVIOUS_ID` (optional, for rotation).

- [ ] **Step 1: Write the failing test**

```ts
import {
  generateSealKeyPair,
  signGenome,
  verifyGenome,
  loadSealKey,
  loadVerificationKeys,
} from '@/lib/flow-key/seal';

const HASH = 'a'.repeat(64);

describe('Ed25519 genome seal', () => {
  const { privateKeyPem, publicKeyPem } = generateSealKeyPair();

  it('round-trips a signature', () => {
    const sig = signGenome(HASH, privateKeyPem);
    expect(verifyGenome(HASH, sig, publicKeyPem)).toBe(true);
  });

  it('produces base64url with no padding', () => {
    expect(signGenome(HASH, privateKeyPem)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('is deterministic (Ed25519 has no nonce)', () => {
    expect(signGenome(HASH, privateKeyPem)).toBe(signGenome(HASH, privateKeyPem));
  });

  it('fails when the genome is tampered with', () => {
    const sig = signGenome(HASH, privateKeyPem);
    expect(verifyGenome('b'.repeat(64), sig, publicKeyPem)).toBe(false);
  });

  it('fails against a different key', () => {
    const other = generateSealKeyPair();
    const sig = signGenome(HASH, privateKeyPem);
    expect(verifyGenome(HASH, sig, other.publicKeyPem)).toBe(false);
  });

  it('returns false rather than throwing on a malformed signature', () => {
    expect(verifyGenome(HASH, 'not-a-signature', publicKeyPem)).toBe(false);
  });
});

describe('loadSealKey', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('throws a clear error when unconfigured', () => {
    delete process.env.FLOW_KEY_SEAL_KEY;
    expect(() => loadSealKey()).toThrow(/FLOW_KEY_SEAL_KEY/);
  });

  it('derives the public key from the private key and reports the key id', () => {
    const { privateKeyPem } = generateSealKeyPair();
    process.env.FLOW_KEY_SEAL_KEY = privateKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-test';
    const loaded = loadSealKey();
    expect(loaded.keyId).toBe('fk-test');
    expect(loaded.publicKeyPem).toContain('BEGIN PUBLIC KEY');
    expect(verifyGenome(HASH, signGenome(HASH, loaded.privateKeyPem), loaded.publicKeyPem)).toBe(
      true
    );
  });

  it('publishes the previous key too, so rotation does not invalidate old spores', () => {
    const current = generateSealKeyPair();
    const previous = generateSealKeyPair();
    process.env.FLOW_KEY_SEAL_KEY = current.privateKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-new';
    process.env.FLOW_KEY_SEAL_KEY_PREVIOUS = previous.publicKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_PREVIOUS_ID = 'fk-old';
    const keys = loadVerificationKeys();
    expect(keys.map(k => k.keyId)).toEqual(['fk-new', 'fk-old']);
  });

  it('returns an empty key list rather than throwing when unconfigured', () => {
    delete process.env.FLOW_KEY_SEAL_KEY;
    expect(loadVerificationKeys()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-seal.test.ts`
Expected: FAIL — `Cannot find module '@/lib/flow-key/seal'`

- [ ] **Step 3: Write minimal implementation**

```ts
// Ed25519 detached signatures over the genome hash. Server-only.
//
// The signature travels inside the spore document, and the public key is served
// from /.well-known/mixhive-flow-key.json, so anyone holding a spore can verify
// integrity and origin with no database, no chain, and no network beyond that
// one static file.
import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from 'node:crypto';

export interface SealKey {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
}

export function generateSealKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

/** Detached Ed25519 signature over the ASCII genome hash, base64url, unpadded. */
export function signGenome(contentHash: string, privateKeyPem: string): string {
  const key = createPrivateKey(privateKeyPem);
  return cryptoSign(null, Buffer.from(contentHash, 'utf8'), key).toString('base64url');
}

export function verifyGenome(
  contentHash: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    return cryptoVerify(
      null,
      Buffer.from(contentHash, 'utf8'),
      createPublicKey(publicKeyPem),
      Buffer.from(signature, 'base64url')
    );
  } catch {
    return false;
  }
}

export function loadSealKey(): SealKey {
  const privateKeyPem = process.env.FLOW_KEY_SEAL_KEY;
  if (!privateKeyPem) {
    throw new Error('FLOW_KEY_SEAL_KEY is not configured; cannot seal a spore');
  }
  const publicKeyPem = createPublicKey(createPrivateKey(privateKeyPem))
    .export({ type: 'spki', format: 'pem' })
    .toString();
  return {
    privateKeyPem,
    publicKeyPem,
    keyId: process.env.FLOW_KEY_SEAL_KEY_ID || 'fk-unversioned',
  };
}

/**
 * Public keys for offline verification, newest first. Rotation keeps the previous
 * public key published so spores sealed before a rotation stay verifiable forever.
 * Returns [] when unconfigured — the well-known endpoint must not 500.
 */
export function loadVerificationKeys(): Array<{ keyId: string; publicKeyPem: string }> {
  const keys: Array<{ keyId: string; publicKeyPem: string }> = [];
  try {
    const current = loadSealKey();
    keys.push({ keyId: current.keyId, publicKeyPem: current.publicKeyPem });
  } catch {
    return [];
  }
  const previous = process.env.FLOW_KEY_SEAL_KEY_PREVIOUS;
  if (previous) {
    keys.push({
      keyId: process.env.FLOW_KEY_SEAL_KEY_PREVIOUS_ID || 'fk-previous',
      publicKeyPem: previous,
    });
  }
  return keys;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-seal.test.ts`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow-key/seal.ts src/__tests__/flow-key-seal.test.ts
git commit -m "feat(flow-key): Ed25519 genome seal + rotation-aware key loading"
```

---

### Task 3: The capping predicate

**Files:**
- Create: `src/lib/flow-key/capping.ts`
- Test: `src/__tests__/flow-key-capping.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type CappableAsset`, `type CappingContext`, `isCapped(asset: CappableAsset, ctx: CappingContext): boolean`, `selectCappedCells(assets: CappableAsset[], ctx: CappingContext): { capped: CappableAsset[]; skipped: CappableAsset[] }`.

This is the ethical core of the feature: it is what stops the tap being a wiretap. Test it hardest.

- [ ] **Step 1: Write the failing test**

```ts
import { isCapped, selectCappedCells, type CappingContext } from '@/lib/flow-key/capping';

const BOUNDARY = '2026-07-30T22:00:00.000Z';
const BEFORE = '2026-07-30T21:59:00.000Z';
const AFTER = '2026-07-30T22:00:01.000Z';

function asset(over: Partial<Parameters<typeof isCapped>[0]> = {}) {
  return {
    id: 'a1',
    created_at: BEFORE,
    upload_complete: true,
    deleted_at: null as string | null,
    ...over,
  };
}

const ctx = (over: Partial<CappingContext> = {}): CappingContext => ({
  boundary: BOUNDARY,
  currentAssetId: null,
  playbackStatus: 'paused',
  manuallyCappedIds: [],
  ...over,
});

describe('isCapped', () => {
  it('caps a settled asset created before the boundary', () => {
    expect(isCapped(asset(), ctx())).toBe(true);
  });

  it('refuses an asset created after the boundary', () => {
    expect(isCapped(asset({ created_at: AFTER }), ctx())).toBe(false);
  });

  it('caps an asset created exactly at the boundary (inclusive)', () => {
    expect(isCapped(asset({ created_at: BOUNDARY }), ctx())).toBe(true);
  });

  it('refuses an incomplete upload', () => {
    expect(isCapped(asset({ upload_complete: false }), ctx())).toBe(false);
  });

  it('refuses a soft-deleted asset', () => {
    expect(isCapped(asset({ deleted_at: BEFORE }), ctx())).toBe(false);
  });

  it('REFUSES the take being played right now — the live take is uncapped', () => {
    expect(isCapped(asset({ id: 'live' }), ctx({ currentAssetId: 'live', playbackStatus: 'playing' })))
      .toBe(false);
  });

  it('caps the current asset once playback is paused', () => {
    expect(isCapped(asset({ id: 'live' }), ctx({ currentAssetId: 'live', playbackStatus: 'paused' })))
      .toBe(true);
  });

  it('caps a playing asset the host explicitly capped (the override)', () => {
    expect(
      isCapped(
        asset({ id: 'live' }),
        ctx({ currentAssetId: 'live', playbackStatus: 'playing', manuallyCappedIds: ['live'] })
      )
    ).toBe(true);
  });

  it('does not let a manual cap override the boundary', () => {
    expect(
      isCapped(asset({ id: 'x', created_at: AFTER }), ctx({ manuallyCappedIds: ['x'] }))
    ).toBe(false);
  });

  it('does not let a manual cap override an incomplete upload', () => {
    expect(
      isCapped(asset({ id: 'x', upload_complete: false }), ctx({ manuallyCappedIds: ['x'] }))
    ).toBe(false);
  });

  it('does not let a manual cap resurrect a deleted asset', () => {
    expect(
      isCapped(asset({ id: 'x', deleted_at: BEFORE }), ctx({ manuallyCappedIds: ['x'] }))
    ).toBe(false);
  });
});

describe('selectCappedCells', () => {
  it('partitions assets and preserves input order in both groups', () => {
    const result = selectCappedCells(
      [
        asset({ id: 'a' }),
        asset({ id: 'b', created_at: AFTER }),
        asset({ id: 'c' }),
        asset({ id: 'd', upload_complete: false }),
      ],
      ctx()
    );
    expect(result.capped.map(a => a.id)).toEqual(['a', 'c']);
    expect(result.skipped.map(a => a.id)).toEqual(['b', 'd']);
  });

  it('returns empty groups for no assets', () => {
    expect(selectCappedCells([], ctx())).toEqual({ capped: [], skipped: [] });
  });

  it('caps nothing when a single asset is mid-playback', () => {
    const result = selectCappedCells(
      [asset({ id: 'only' })],
      ctx({ currentAssetId: 'only', playbackStatus: 'playing' })
    );
    expect(result.capped).toHaveLength(0);
    expect(result.skipped.map(a => a.id)).toEqual(['only']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-capping.test.ts`
Expected: FAIL — `Cannot find module '@/lib/flow-key/capping'`

- [ ] **Step 3: Write minimal implementation**

```ts
// Which comb cells are ready to drain.
//
// A Flow Frame only drains CAPPED honey — uncapped cells hold nectar that is
// still curing. Ported over: the take being played right now is never harvested.
// That refusal is mechanical, not a policy promise, and it is the reason this
// tap is not a surveillance device.

export interface CappableAsset {
  id: string;
  created_at: string;
  upload_complete: boolean;
  deleted_at: string | null;
}

export interface CappingContext {
  /** flow_key_taps.opened_at — the snapshot boundary. */
  boundary: string;
  currentAssetId: string | null;
  playbackStatus: 'paused' | 'playing';
  /** Assets the host explicitly capped via a flow_key_cap event. */
  manuallyCappedIds: string[];
}

export function isCapped<T extends CappableAsset>(asset: T, ctx: CappingContext): boolean {
  // Unconditional gates — a manual cap can never override any of these.
  if (!asset.upload_complete) return false;
  if (asset.deleted_at !== null) return false;
  if (new Date(asset.created_at).getTime() > new Date(ctx.boundary).getTime()) return false;

  const isLiveTake = asset.id === ctx.currentAssetId && ctx.playbackStatus === 'playing';
  if (!isLiveTake) return true;

  // The live take drains only when the host has deliberately capped it.
  return ctx.manuallyCappedIds.includes(asset.id);
}

export function selectCappedCells<T extends CappableAsset>(
  assets: T[],
  ctx: CappingContext
): { capped: T[]; skipped: T[] } {
  const capped: T[] = [];
  const skipped: T[] = [];
  for (const asset of assets) {
    (isCapped(asset, ctx) ? capped : skipped).push(asset);
  }
  return { capped, skipped };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-capping.test.ts`
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow-key/capping.ts src/__tests__/flow-key-capping.test.ts
git commit -m "feat(flow-key): capped-cell predicate — the live take never drains"
```

---

### Task 4: Migration 119 — tables, RLS, graph extensions, RPCs

**Files:**
- Create: `supabase/migrations/119_flow_key_spine.sql`

**Interfaces:**
- Produces (callable via `sb.rpc(...)`):
  - `turn_flow_key(p_session_id uuid) returns jsonb` → `{spore_id, opened_at, turns_count}` or raises
  - `seal_flow_spore(p_spore_id uuid, p_carbon jsonb, p_silica jsonb, p_content_hash text, p_signature text, p_key_id text, p_storage_path text, p_capped int, p_skipped int, p_contributors jsonb) returns jsonb`
  - `revoke_flow_key(p_session_id uuid) returns jsonb`
  - `reap_stale_flow_drains() returns int`
- Existing helpers reused: `can_manage_collab_session(p_session_id uuid)`, `can_view_collab_session(p_session_id uuid)` (migration 097).

- [ ] **Step 1: Write the migration**

```sql
-- Migration 119: Flow Key spine (FK-1)
--
-- Non-invasive harvest from a RUNNING ritual. A per-session drain lock
-- (flow_key_taps) guarantees one drain at a time, mirroring a real Flow Hive
-- where one frame drains at a time. Spores are durable, self-verifying
-- artifacts: content_hash is sha256 over the JCS-canonical genome and
-- seal_signature is a detached Ed25519 signature over that hash.
--
-- The capped-cell predicate deliberately lives in TypeScript
-- (src/lib/flow-key/capping.ts) where it is unit-tested; these RPCs own only
-- the atomic lock and the state machine.
--
-- Audio never enters the genome — carbon holds per-asset content digests only.
--
-- Resolves: P7.5 FK-1

begin;

-- ── 1. flow_spores ──────────────────────────────────────────────────────────

create table if not exists public.flow_spores (
  id              uuid primary key default gen_random_uuid(),
  session_id      uuid not null references public.collab_sessions(id) on delete cascade,
  turned_by       uuid not null references public.profiles(id) on delete cascade,
  state           text not null default 'draining'
                    check (state in ('draining','sealed','void')),
  opened_at       timestamptz not null default now(),
  sealed_at       timestamptz,
  generation      int not null default 0,
  parent_hash     text,
  root_session_id uuid references public.collab_sessions(id) on delete set null,
  carbon          jsonb not null default '{}'::jsonb,
  silica          jsonb not null default '{}'::jsonb,
  capped_count    int not null default 0,
  skipped_count   int not null default 0,
  genome_version  int not null default 1,
  content_hash    text,
  seal_signature  text,
  seal_key_id     text,
  storage_path    text,
  created_at      timestamptz not null default now()
);

create unique index if not exists flow_spores_content_hash_idx
  on public.flow_spores (content_hash) where content_hash is not null;
create index if not exists flow_spores_session_idx
  on public.flow_spores (session_id, created_at desc);
create index if not exists flow_spores_turned_by_idx
  on public.flow_spores (turned_by, created_at desc);
-- Drives the reaper.
create index if not exists flow_spores_draining_idx
  on public.flow_spores (opened_at) where state = 'draining';

-- ── 2. flow_key_taps — the drain lock ───────────────────────────────────────

create table if not exists public.flow_key_taps (
  session_id  uuid primary key references public.collab_sessions(id) on delete cascade,
  is_open     boolean not null default false,
  opened_by   uuid references public.profiles(id) on delete set null,
  opened_at   timestamptz,
  drain_lock  uuid references public.flow_spores(id) on delete set null,
  turns_count int not null default 0
);

-- ── 3. flow_spore_contributors ──────────────────────────────────────────────

create table if not exists public.flow_spore_contributors (
  id         uuid primary key default gen_random_uuid(),
  spore_id   uuid not null references public.flow_spores(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  agent_id   uuid references public.ai_agents(id) on delete set null,
  fraction   text not null check (fraction in ('carbon','silica')),
  role       text not null,
  weight     numeric not null default 0,
  created_at timestamptz not null default now(),
  constraint flow_spore_contributors_subject
    check (profile_id is not null or agent_id is not null)
);

create unique index if not exists flow_spore_contributors_profile_idx
  on public.flow_spore_contributors (spore_id, profile_id) where profile_id is not null;
create unique index if not exists flow_spore_contributors_agent_idx
  on public.flow_spore_contributors (spore_id, agent_id) where agent_id is not null;

-- ── 4. flow_spore_grants — single-use download tokens (FK-2 extends this) ───

create table if not exists public.flow_spore_grants (
  id              uuid primary key default gen_random_uuid(),
  spore_id        uuid not null references public.flow_spores(id) on delete cascade,
  issued_by       uuid not null references public.profiles(id) on delete cascade,
  grantee_profile uuid references public.profiles(id) on delete cascade,
  rights          text[] not null default array['read']::text[],
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists flow_spore_grants_spore_idx
  on public.flow_spore_grants (spore_id, created_at desc);

-- ── 5. RLS ──────────────────────────────────────────────────────────────────
-- Writes are RPC-only (security definer) or service-role. No client write
-- policies are granted on any table in this migration.

alter table public.flow_spores enable row level security;
alter table public.flow_key_taps enable row level security;
alter table public.flow_spore_contributors enable row level security;
alter table public.flow_spore_grants enable row level security;

drop policy if exists "flow spores visible to turner and contributors" on public.flow_spores;
create policy "flow spores visible to turner and contributors"
  on public.flow_spores for select
  using (
    turned_by = auth.uid()
    or exists (
      select 1 from public.flow_spore_contributors c
      where c.spore_id = flow_spores.id and c.profile_id = auth.uid()
    )
  );

drop policy if exists "flow key tap visible to the room" on public.flow_key_taps;
create policy "flow key tap visible to the room"
  on public.flow_key_taps for select
  using (public.can_view_collab_session(session_id));

drop policy if exists "spore contributors visible to the spore audience" on public.flow_spore_contributors;
create policy "spore contributors visible to the spore audience"
  on public.flow_spore_contributors for select
  using (
    profile_id = auth.uid()
    or exists (
      select 1 from public.flow_spores s
      where s.id = flow_spore_contributors.spore_id and s.turned_by = auth.uid()
    )
  );

drop policy if exists "spore grants visible to issuer and grantee" on public.flow_spore_grants;
create policy "spore grants visible to issuer and grantee"
  on public.flow_spore_grants for select
  using (issued_by = auth.uid() or grantee_profile = auth.uid());

-- ── 6. Graph extensions ─────────────────────────────────────────────────────

alter table public.mythic_nodes drop constraint if exists mythic_nodes_node_type_check;
alter table public.mythic_nodes add constraint mythic_nodes_node_type_check
  check (node_type in (
    'artist_profile','mix','buzz','event','venue','opportunity','promoter',
    'label','curator','quest','agent','collab_session','nft_collection',
    'flow_spore'
  ));

alter table public.mythic_edges drop constraint if exists mythic_edges_edge_type_check;
alter table public.mythic_edges add constraint mythic_edges_edge_type_check
  check (edge_type in (
    'performed_at','booked_by','submitted_to','collab_with','remixed',
    'engaged_with','recommended_by_agent','followed','inspired_by',
    'quest_milestone','yielded_outcome','similar_artist',
    'session_produced_mix','owns_nft_of','backed_by','backed_quest',
    'drained_from','germinated_into'
  ));

-- ── 7. turn_flow_key ────────────────────────────────────────────────────────
-- Atomic: asserts host, asserts no open drain, opens the tap, creates the
-- draining spore, records the visible turn event. The room SEES the turn —
-- that is what makes quiet extraction structurally impossible.

create or replace function public.turn_flow_key(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spore_id uuid;
  v_now timestamptz := now();
  v_turns int;
begin
  if not public.can_manage_collab_session(p_session_id) then
    raise exception 'Not authorized: only creators can turn the Flow Key'
      using errcode = '42501';
  end if;

  insert into public.flow_key_taps (session_id)
  values (p_session_id)
  on conflict (session_id) do nothing;

  -- Lock the tap row so two simultaneous turns cannot both pass the check.
  perform 1 from public.flow_key_taps where session_id = p_session_id for update;

  if exists (
    select 1 from public.flow_key_taps
    where session_id = p_session_id and is_open
  ) then
    raise exception 'drain_already_open' using errcode = '55006';
  end if;

  insert into public.flow_spores (session_id, turned_by, opened_at, root_session_id)
  values (p_session_id, auth.uid(), v_now, p_session_id)
  returning id into v_spore_id;

  update public.flow_key_taps
     set is_open = true,
         opened_by = auth.uid(),
         opened_at = v_now,
         drain_lock = v_spore_id,
         turns_count = turns_count + 1
   where session_id = p_session_id
  returning turns_count into v_turns;

  insert into public.collab_session_events (session_id, actor_id, event_type, payload)
  values (
    p_session_id, auth.uid(), 'flow_key_turned',
    jsonb_build_object('spore_id', v_spore_id)
  );

  return jsonb_build_object(
    'spore_id', v_spore_id,
    'opened_at', v_now,
    'turns_count', v_turns
  );
end;
$$;

comment on function public.turn_flow_key(uuid) is
  'Opens the Flow Key drain for a session: asserts host permission, takes the single-drain lock, creates a draining flow_spores row, and records a visible flow_key_turned event. Raises 55006 (drain_already_open) if a drain is in progress.';

-- ── 8. seal_flow_spore ──────────────────────────────────────────────────────
-- Service-role only: the genome hash and Ed25519 signature are produced by the
-- server, never by a client.

create or replace function public.seal_flow_spore(
  p_spore_id uuid,
  p_carbon jsonb,
  p_silica jsonb,
  p_content_hash text,
  p_signature text,
  p_key_id text,
  p_storage_path text,
  p_capped int,
  p_skipped int,
  p_contributors jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id uuid;
  v_sealed_at timestamptz := now();
  v_row jsonb;
begin
  select session_id into v_session_id
    from public.flow_spores
   where id = p_spore_id and state = 'draining'
     for update;

  if v_session_id is null then
    raise exception 'Spore not found or not draining' using errcode = 'P0002';
  end if;

  update public.flow_spores
     set state = 'sealed',
         sealed_at = v_sealed_at,
         carbon = coalesce(p_carbon, '{}'::jsonb),
         silica = coalesce(p_silica, '{}'::jsonb),
         content_hash = p_content_hash,
         seal_signature = p_signature,
         seal_key_id = p_key_id,
         storage_path = p_storage_path,
         capped_count = coalesce(p_capped, 0),
         skipped_count = coalesce(p_skipped, 0)
   where id = p_spore_id;

  insert into public.flow_spore_contributors
    (spore_id, profile_id, agent_id, fraction, role, weight)
  select
    p_spore_id,
    nullif(c->>'profile_id','')::uuid,
    nullif(c->>'agent_id','')::uuid,
    c->>'fraction',
    c->>'role',
    coalesce((c->>'weight')::numeric, 0)
  from jsonb_array_elements(coalesce(p_contributors, '[]'::jsonb)) as c
  on conflict do nothing;

  update public.flow_key_taps
     set is_open = false, drain_lock = null
   where session_id = v_session_id;

  insert into public.collab_session_events (session_id, actor_id, event_type, payload)
  values (
    v_session_id,
    (select turned_by from public.flow_spores where id = p_spore_id),
    'flow_key_sealed',
    jsonb_build_object('spore_id', p_spore_id, 'content_hash', p_content_hash,
                       'capped', p_capped, 'skipped', p_skipped)
  );

  select to_jsonb(s) into v_row from public.flow_spores s where s.id = p_spore_id;
  return v_row;
end;
$$;

comment on function public.seal_flow_spore(uuid,jsonb,jsonb,text,text,text,text,int,int,jsonb) is
  'Seals a draining spore: writes the carbon/silica fractions, genome hash, Ed25519 signature and storage path, inserts contributor provenance, closes the drain lock, and records flow_key_sealed. Service-role only.';

-- ── 9. revoke_flow_key ──────────────────────────────────────────────────────

create or replace function public.revoke_flow_key(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_spore_id uuid;
begin
  if not public.can_manage_collab_session(p_session_id) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select drain_lock into v_spore_id
    from public.flow_key_taps
   where session_id = p_session_id and is_open
     for update;

  if v_spore_id is null then
    return jsonb_build_object('revoked', false);
  end if;

  update public.flow_spores set state = 'void' where id = v_spore_id;
  update public.flow_key_taps
     set is_open = false, drain_lock = null
   where session_id = p_session_id;

  insert into public.collab_session_events (session_id, actor_id, event_type, payload)
  values (p_session_id, auth.uid(), 'flow_key_revoked',
          jsonb_build_object('spore_id', v_spore_id));

  return jsonb_build_object('revoked', true, 'spore_id', v_spore_id);
end;
$$;

comment on function public.revoke_flow_key(uuid) is
  'Host kills an open drain: voids the draining spore and closes the tap.';

-- ── 10. reap_stale_flow_drains ──────────────────────────────────────────────
-- A session must never be left with a stuck-open key.

create or replace function public.reap_stale_flow_drains()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  with stale as (
    select id, session_id from public.flow_spores
     where state = 'draining' and opened_at < now() - interval '15 minutes'
     for update skip locked
  ), voided as (
    update public.flow_spores s set state = 'void'
      where s.id in (select id from stale)
      returning s.id, s.session_id
  )
  update public.flow_key_taps t
     set is_open = false, drain_lock = null
   where t.session_id in (select session_id from voided);

  select count(*) into v_count
    from public.flow_spores
   where state = 'void' and opened_at < now() - interval '15 minutes';

  return v_count;
end;
$$;

comment on function public.reap_stale_flow_drains() is
  'Cron: voids draining spores older than 15 minutes and closes their taps so a session is never left with a stuck-open Flow Key.';

revoke all on function public.seal_flow_spore(uuid,jsonb,jsonb,text,text,text,text,int,int,jsonb) from anon, authenticated;
revoke all on function public.reap_stale_flow_drains() from anon, authenticated;

commit;

-- Resolves: P7.5 FK-1 (Flow Key spine)
```

- [ ] **Step 2: Verify it parses and is idempotent — on a LOCAL database**

There is no scratch/staging Supabase project: `supabase/.temp/project-ref` is
`ljdolmqytncxhgojqguh`, which is **production**. Never run this file against the
linked project. Use the local stack (Docker is required and available):

```bash
supabase start                      # local Postgres on 54322
export LOCAL_DB="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
for f in supabase/migrations/[0-9]*.sql; do
  psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -q -f "$f" || { echo "FAILED: $f"; break; }
done
psql "$LOCAL_DB" -v ON_ERROR_STOP=1 -f supabase/migrations/119_flow_key_spine.sql
```

Expected: the full 001→119 chain applies cleanly, and the final re-run of 119
also exits 0 — which is what proves idempotency. Applying the whole chain (not
just 119) is deliberate: it is the only way to confirm 119's prerequisites
(`collab_session_assets` from 097, `mix_agent_credits` from 103, `ai_agents`
from 104) actually exist in a from-scratch build.

- [ ] **Step 3: Verify the constraint extensions did not drop an existing type**

```bash
psql "$LOCAL_DB" -c "\d+ public.mythic_edges" | grep edge_type_check
```

Expected: the printed check contains all 16 pre-existing types **plus** `drained_from` and `germinated_into`. If any pre-existing type is missing, the migration is destructive — stop and fix.

- [ ] **Step 4: Regenerate types**

```bash
npm run db:types
```

Expected: `src/lib/database.types.ts` gains `flow_spores`, `flow_key_taps`, `flow_spore_contributors`, `flow_spore_grants`. Never hand-edit this file.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/119_flow_key_spine.sql src/lib/database.types.ts
git commit -m "feat(flow-key): migration 119 — taps, spores, contributors, grants, RPCs"
```

---

### Task 5: Spore assembly

**Files:**
- Create: `src/lib/flow-key/spore.ts`
- Test: `src/__tests__/flow-key-spore.test.ts`

**Interfaces:**
- Consumes: `genomeHash` (Task 1), `signGenome`/`loadSealKey` (Task 2), `selectCappedCells` (Task 3).
- Produces: `type SporeInput`, `type SporeDocument`, `assembleSpore(input: SporeInput): SporeDocument` where `SporeDocument = { genome: {...}, content_hash: string, seal: { signature, key_id, algorithm: 'ed25519' }, contributors: Contributor[], capped_count: number, skipped_count: number }`.

- [ ] **Step 1: Write the failing test**

```ts
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
  agentCredits: [{ agent_id: 'ag1', actions: 2 }],
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
    expect(doc.genome.silica.agent_credits).toEqual([{ agent_id: 'ag1', actions: 2 }]);
    expect(doc.genome.silica.detected).toEqual({ musical_key: '8A', bpm: 138 });
    expect(doc.genome.carbon.capped.map(c => c.id)).toEqual(['a1']);
  });

  it('lists every human who contributed a capped asset or a mark, plus the host', () => {
    const doc = assembleSpore(input());
    const carbon = doc.contributors.filter(c => c.fraction === 'carbon');
    expect(carbon.map(c => c.profile_id).sort()).toEqual(['u1', 'u2']);
    expect(carbon.find(c => c.profile_id === 'u1')?.role).toBe('host');
    expect(doc.contributors.find(c => c.agent_id === 'ag1')?.fraction).toBe('silica');
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-spore.test.ts`
Expected: FAIL — `Cannot find module '@/lib/flow-key/spore'`

- [ ] **Step 3: Write minimal implementation**

```ts
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
  agentCredits: Array<{ agent_id: string; actions: number }>;
  detected: { musical_key: string | null; bpm: number | null };
  hostProfileId: string;
  sealKey: { privateKeyPem: string; keyId: string };
}

export interface Contributor {
  profile_id: string | null;
  agent_id: string | null;
  fraction: 'carbon' | 'silica';
  role: string;
  weight: number;
}

export interface SporeDocument {
  genome: {
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
      agent_credits: Array<{ agent_id: string; actions: number }>;
      detected: { musical_key: string | null; bpm: number | null };
    };
  };
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
      agent_id: null,
      fraction: 'carbon' as const,
      role: profile_id === input.hostProfileId ? 'host' : 'contributor',
      weight: 0,
    })),
    ...input.agentCredits.map(credit => ({
      profile_id: null,
      agent_id: credit.agent_id,
      fraction: 'silica' as const,
      role: 'agent',
      weight: 0,
    })),
  ];

  const genome: SporeDocument['genome'] = {
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-spore.test.ts`
Expected: PASS (10 tests). The `does NOT change hash when a skipped asset changes` test is the one that proves uncapped material is genuinely absent from the harvest.

- [ ] **Step 5: Commit**

```bash
git add src/lib/flow-key/spore.ts src/__tests__/flow-key-spore.test.ts
git commit -m "feat(flow-key): spore assembly — capped cells only, digests not audio"
```

---

### Task 6: `POST turn` and `GET state`

**Files:**
- Create: `src/app/api/mythic/sessions/[id]/flow-key/route.ts`
- Test: `src/__tests__/flow-key-turn-route.test.ts`

**Interfaces:**
- Consumes: `ritualAuth` from `src/app/api/mythic/sessions/_lib.ts`, `handleApiError` from `src/lib/api-errors.ts`, `selectCappedCells` (Task 3), `turn_flow_key` RPC (Task 4).
- Produces: `POST` → `{ spore_id, capped, skipped, turns_count }` (201); `GET` → `{ is_open, opened_at, turns_count, capped, skipped, spore_id }`.

- [ ] **Step 1: Write the failing test**

```ts
/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/mythic/sessions/[id]/flow-key/route';

const assets = [
  { id: 'a1', created_at: '2026-07-30T21:00:00.000Z', upload_complete: true, deleted_at: null },
  { id: 'a2', created_at: '2026-07-30T21:30:00.000Z', upload_complete: true, deleted_at: null },
];
const state = { current_asset_id: 'a2', playback_status: 'playing' };
const tap = { is_open: false, opened_at: null, turns_count: 0, drain_lock: null };

const fromMock = jest.fn();
const rpcMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

function makeChain(result: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.is = pass;
  chain.order = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.then = thenable.then;
  return chain;
}

function wire() {
  fromMock.mockImplementation((table: string) => {
    if (table === 'collab_session_assets') return makeChain(assets);
    if (table === 'collab_session_state') return makeChain(state);
    if (table === 'flow_key_taps') return makeChain(tap);
    if (table === 'collab_session_events') return makeChain([]);
    return makeChain(null);
  });
}

const authed = (method: string) =>
  new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key', {
    method,
    headers: { authorization: 'Bearer token' },
  });

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => {
  jest.clearAllMocks();
  wire();
});

describe('POST /api/mythic/sessions/[id]/flow-key', () => {
  it('401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('turns the key and reports the capped count, excluding the live take', async () => {
    rpcMock.mockResolvedValue({
      data: { spore_id: 'sp1', opened_at: '2026-07-30T22:00:00.000Z', turns_count: 1 },
      error: null,
    });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ spore_id: 'sp1', capped: 1, skipped: 1, turns_count: 1 });
    expect(rpcMock).toHaveBeenCalledWith('turn_flow_key', { p_session_id: 's1' });
  });

  it('422 nothing_capped when only the live take exists, and does not open the tap', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'collab_session_assets')
        return makeChain([
          { id: 'a2', created_at: '2026-07-30T21:30:00.000Z', upload_complete: true, deleted_at: null },
        ]);
      if (table === 'collab_session_state') return makeChain(state);
      if (table === 'flow_key_taps') return makeChain(tap);
      if (table === 'collab_session_events') return makeChain([]);
      return makeChain(null);
    });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('nothing_capped');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('409 drain_already_open when the RPC reports the lock is taken', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'drain_already_open', code: '55006' } });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('drain_already_open');
  });

  it('403 when the caller is not a host', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'Not authorized: only creators can turn the Flow Key', code: '42501' },
    });
    const res = await POST(authed('POST'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/mythic/sessions/[id]/flow-key', () => {
  it('reports tap state and live capped counts for the room', async () => {
    const res = await GET(authed('GET'), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ is_open: false, turns_count: 0, capped: 1, skipped: 1 });
  });

  it('401 without auth', async () => {
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key'),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-turn-route.test.ts`
Expected: FAIL — cannot resolve the route module

- [ ] **Step 3: Write minimal implementation**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { selectCappedCells, type CappableAsset } from '@/lib/flow-key/capping';
import { ritualAuth } from '../../_lib';

interface AssetRow extends CappableAsset {
  id: string;
}

async function cappedCounts(
  sb: Awaited<ReturnType<typeof ritualAuth>> extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof ritualAuth>>>['sb'],
  sessionId: string,
  boundary: string
) {
  const [{ data: assets }, { data: state }, { data: capEvents }] = await Promise.all([
    sb
      .from('collab_session_assets')
      .select('id, created_at, upload_complete, deleted_at')
      .eq('session_id', sessionId),
    sb
      .from('collab_session_state')
      .select('current_asset_id, playback_status')
      .eq('session_id', sessionId)
      .maybeSingle(),
    sb
      .from('collab_session_events')
      .select('payload')
      .eq('session_id', sessionId)
      .eq('event_type', 'flow_key_cap'),
  ]);

  const manuallyCappedIds = ((capEvents ?? []) as Array<{ payload?: { asset_id?: string } }>)
    .map(e => e.payload?.asset_id)
    .filter((id): id is string => Boolean(id));

  return selectCappedCells((assets ?? []) as AssetRow[], {
    boundary,
    currentAssetId: (state?.current_asset_id as string | null) ?? null,
    playbackStatus: (state?.playback_status as 'paused' | 'playing') ?? 'paused',
    manuallyCappedIds,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    // Boundary for the pre-check is now; the RPC records the authoritative
    // opened_at, and the seal re-derives counts from it.
    const { capped, skipped } = await cappedCounts(ctx.sb, id, new Date().toISOString());

    if (capped.length === 0) {
      return NextResponse.json(
        { error: 'nothing_capped', capped: 0, skipped: skipped.length },
        { status: 422 }
      );
    }

    const { data, error } = await ctx.sb.rpc('turn_flow_key', { p_session_id: id });
    if (error) {
      if (error.message.includes('drain_already_open')) {
        return NextResponse.json({ error: 'drain_already_open' }, { status: 409 });
      }
      if (error.message.includes('Not authorized')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const result = data as { spore_id: string; opened_at: string; turns_count: number };
    return NextResponse.json(
      {
        spore_id: result.spore_id,
        opened_at: result.opened_at,
        turns_count: result.turns_count,
        capped: capped.length,
        skipped: skipped.length,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'flow-key:turn');
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { data: tap } = await ctx.sb
      .from('flow_key_taps')
      .select('is_open, opened_at, turns_count, drain_lock')
      .eq('session_id', id)
      .maybeSingle();

    const boundary = (tap?.opened_at as string | null) ?? new Date().toISOString();
    const { capped, skipped } = await cappedCounts(ctx.sb, id, boundary);

    return NextResponse.json({
      is_open: Boolean(tap?.is_open),
      opened_at: (tap?.opened_at as string | null) ?? null,
      turns_count: (tap?.turns_count as number | undefined) ?? 0,
      spore_id: (tap?.drain_lock as string | null) ?? null,
      capped: capped.length,
      skipped: skipped.length,
    });
  } catch (error) {
    return handleApiError(error, 'flow-key:state');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-turn-route.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Add `upload_complete` and `deleted_at` if they do not exist**

Run:

```bash
grep -n "upload_complete\|deleted_at" supabase/migrations/097_mythic_live_rituals.sql
```

If absent, append to `119_flow_key_spine.sql` **before** the `commit;`:

```sql
alter table public.collab_session_assets
  add column if not exists upload_complete boolean not null default true,
  add column if not exists deleted_at timestamptz;
```

`default true` is correct: every existing row was inserted after its upload finished. Then re-run Task 4 Step 2 and `npm run db:types`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/mythic/sessions/'[id]'/flow-key/route.ts src/__tests__/flow-key-turn-route.test.ts supabase/migrations/119_flow_key_spine.sql src/lib/database.types.ts
git commit -m "feat(flow-key): POST turn + GET state routes"
```

---

### Task 7: `POST seal`

**Files:**
- Create: `src/app/api/mythic/sessions/[id]/flow-key/seal/route.ts`
- Test: `src/__tests__/flow-key-seal-route.test.ts`

**Interfaces:**
- Consumes: `ritualAuth`, `assembleSpore` (Task 5), `loadSealKey` (Task 2), `makeServiceClient` from `src/lib/stripe-connect.ts` — **no**: import `createServerClient` from `@/lib/supabase` instead, matching the handoff route.
- Produces: `POST` → `{ spore_id, content_hash, capped, skipped, seal: { key_id, algorithm } }`.

- [ ] **Step 1: Write the failing test**

```ts
/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { generateSealKeyPair, verifyGenome } from '@/lib/flow-key/seal';

const { privateKeyPem, publicKeyPem } = generateSealKeyPair();

const spore = {
  id: 'sp1',
  session_id: 's1',
  state: 'draining',
  opened_at: '2026-07-30T22:00:00.000Z',
  generation: 0,
  parent_hash: null,
  turned_by: 'u1',
};

const rpcMock = jest.fn();
const fromMock = jest.fn();
const uploadMock = jest.fn().mockResolvedValue({ data: { path: 'ok' }, error: null });

function makeChain(result: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  const thenable = { then: (resolve: Function) => resolve({ data: result, error }) };
  chain.select = pass;
  chain.eq = pass;
  chain.maybeSingle = () => thenable;
  chain.single = () => thenable;
  chain.then = thenable.then;
  return chain;
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: fromMock,
    rpc: rpcMock,
    storage: { from: () => ({ upload: uploadMock }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
  process.env.FLOW_KEY_SEAL_KEY = privateKeyPem;
  process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-test';
});

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'flow_spores') return makeChain(spore);
    if (table === 'collab_session_assets')
      return makeChain([
        {
          id: 'a1',
          name: 'kick',
          created_at: '2026-07-30T21:00:00.000Z',
          upload_complete: true,
          deleted_at: null,
          uploader_id: 'u1',
          duration_seconds: 120,
          metadata: { digest: 'd1' },
        },
      ]);
    if (table === 'collab_session_state')
      return makeChain({ current_asset_id: null, playback_status: 'paused' });
    if (table === 'collab_session_events') return makeChain([]);
    if (table === 'mix_agent_credits') return makeChain([]);
    return makeChain(null);
  });
  rpcMock.mockResolvedValue({ data: { id: 'sp1', state: 'sealed' }, error: null });
});

describe('POST .../flow-key/seal', () => {
  it('401 without auth', async () => {
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/seal', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('seals with a verifiable signature and calls the RPC', async () => {
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/seal', {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: JSON.stringify({ spore_id: 'sp1' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.capped).toBe(1);
    expect(rpcMock).toHaveBeenCalledWith('seal_flow_spore', expect.objectContaining({
      p_spore_id: 'sp1',
      p_content_hash: body.content_hash,
      p_key_id: 'fk-test',
    }));
    const call = rpcMock.mock.calls[0][1];
    expect(verifyGenome(body.content_hash, call.p_signature, publicKeyPem)).toBe(true);
  });

  it('uploads the spore document to the private flow-spores bucket', async () => {
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/seal', {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: JSON.stringify({ spore_id: 'sp1' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringContaining('sp1'),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/json' })
    );
  });

  it('404 when the spore is not draining', async () => {
    fromMock.mockImplementation((table: string) =>
      table === 'flow_spores' ? makeChain(null) : makeChain([])
    );
    const { POST } = await import('@/app/api/mythic/sessions/[id]/flow-key/seal/route');
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/seal', {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: JSON.stringify({ spore_id: 'sp1' }),
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-seal-route.test.ts`
Expected: FAIL — cannot resolve the seal route module

- [ ] **Step 3: Write minimal implementation**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';
import { assembleSpore, type SporeAsset } from '@/lib/flow-key/spore';
import { loadSealKey } from '@/lib/flow-key/seal';
import { ritualAuth } from '../../../_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;
    const { spore_id } = (await req.json().catch(() => ({}))) as { spore_id?: string };
    if (!spore_id) return NextResponse.json({ error: 'spore_id required' }, { status: 400 });

    const sb = createServerClient();

    const { data: spore } = await sb
      .from('flow_spores')
      .select('id, session_id, state, opened_at, generation, parent_hash, turned_by')
      .eq('id', spore_id)
      .eq('session_id', id)
      .eq('state', 'draining')
      .maybeSingle();

    if (!spore) {
      return NextResponse.json({ error: 'Spore not found or not draining' }, { status: 404 });
    }

    const [{ data: assetRows }, { data: state }, { data: markRows }, { data: credits }] =
      await Promise.all([
        sb
          .from('collab_session_assets')
          .select(
            'id, name, created_at, upload_complete, deleted_at, uploader_id, duration_seconds, metadata'
          )
          .eq('session_id', id),
        sb
          .from('collab_session_state')
          .select('current_asset_id, playback_status')
          .eq('session_id', id)
          .maybeSingle(),
        sb
          .from('collab_session_events')
          .select('id, event_type, actor_id, created_at, payload')
          .eq('session_id', id),
        sb.from('mix_agent_credits').select('agent_id').eq('session_id', id),
      ]);

    const events = (markRows ?? []) as Array<{
      id: string;
      event_type: string;
      actor_id: string | null;
      created_at: string;
      payload: { asset_id?: string } | null;
    }>;

    const assets: SporeAsset[] = ((assetRows ?? []) as Array<Record<string, unknown>>).map(row => ({
      id: row.id as string,
      name: row.name as string,
      created_at: row.created_at as string,
      upload_complete: (row.upload_complete as boolean | null) ?? true,
      deleted_at: (row.deleted_at as string | null) ?? null,
      uploader_id: row.uploader_id as string,
      duration_seconds: (row.duration_seconds as number | null) ?? null,
      // Digest is written by the audio worker; fall back to the storage path
      // hash surrogate recorded in metadata. Audio itself never enters here.
      digest: String((row.metadata as { digest?: string } | null)?.digest ?? ''),
    }));

    const agentCounts = new Map<string, number>();
    for (const credit of (credits ?? []) as Array<{ agent_id: string }>) {
      agentCounts.set(credit.agent_id, (agentCounts.get(credit.agent_id) ?? 0) + 1);
    }

    const doc = assembleSpore({
      sporeId: spore.id as string,
      sessionId: id,
      boundary: spore.opened_at as string,
      generation: (spore.generation as number) ?? 0,
      parentHash: (spore.parent_hash as string | null) ?? null,
      assets,
      currentAssetId: (state?.current_asset_id as string | null) ?? null,
      playbackStatus: (state?.playback_status as 'paused' | 'playing') ?? 'paused',
      manuallyCappedIds: events
        .filter(e => e.event_type === 'flow_key_cap')
        .map(e => e.payload?.asset_id)
        .filter((v): v is string => Boolean(v)),
      marks: events
        .filter(e => ['mark', 'vote', 'chat-message'].includes(e.event_type))
        .map(e => ({
          id: e.id,
          event_type: e.event_type,
          actor_id: e.actor_id,
          created_at: e.created_at,
        })),
      agentCredits: [...agentCounts].map(([agent_id, actions]) => ({ agent_id, actions })),
      detected: { musical_key: null, bpm: null },
      hostProfileId: spore.turned_by as string,
      sealKey: (() => {
        const key = loadSealKey();
        return { privateKeyPem: key.privateKeyPem, keyId: key.keyId };
      })(),
    });

    const storagePath = `${id}/${doc.genome.spore_id}.json`;
    const { error: uploadError } = await sb.storage
      .from('flow-spores')
      .upload(storagePath, Buffer.from(JSON.stringify(doc), 'utf8'), {
        contentType: 'application/json',
        upsert: true,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { error: sealError } = await sb.rpc('seal_flow_spore', {
      p_spore_id: spore.id,
      p_carbon: doc.genome.carbon,
      p_silica: doc.genome.silica,
      p_content_hash: doc.content_hash,
      p_signature: doc.seal.signature,
      p_key_id: doc.seal.key_id,
      p_storage_path: storagePath,
      p_capped: doc.capped_count,
      p_skipped: doc.skipped_count,
      p_contributors: doc.contributors,
    });
    if (sealError) return NextResponse.json({ error: sealError.message }, { status: 400 });

    return NextResponse.json({
      spore_id: spore.id,
      content_hash: doc.content_hash,
      capped: doc.capped_count,
      skipped: doc.skipped_count,
      seal: { key_id: doc.seal.key_id, algorithm: doc.seal.algorithm },
    });
  } catch (error) {
    return handleApiError(error, 'flow-key:seal');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-seal-route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create the private storage bucket**

Append to `119_flow_key_spine.sql` before `commit;`:

```sql
insert into storage.buckets (id, name, public)
values ('flow-spores', 'flow-spores', false)
on conflict (id) do nothing;
```

Re-run Task 4 Step 2 to confirm idempotency still holds.

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/mythic/sessions/[id]/flow-key/seal/route.ts" src/__tests__/flow-key-seal-route.test.ts supabase/migrations/119_flow_key_spine.sql
git commit -m "feat(flow-key): POST seal — canonicalize, hash, sign, store"
```

---

### Task 8: `POST revoke` and the reaper cron

**Files:**
- Create: `src/app/api/mythic/sessions/[id]/flow-key/revoke/route.ts`
- Create: `src/app/api/cron/flow-key-reap/route.ts`
- Test: `src/__tests__/flow-key-revoke-route.test.ts`

**Interfaces:**
- Consumes: `revoke_flow_key` and `reap_stale_flow_drains` RPCs (Task 4).
- Produces: `POST revoke` → `{ revoked: boolean, spore_id?: string }`; cron `GET` → `{ voided: number }`.
- Cron auth: match the existing pattern in `src/app/api/cron/` — read it first and copy it exactly rather than inventing a scheme.

- [ ] **Step 1: Read the existing cron auth pattern**

Run: `ls src/app/api/cron && sed -n 1,25p src/app/api/cron/cleanup/route.ts`
Use whatever `CRON_SECRET` check that file uses, verbatim.

- [ ] **Step 2: Write the failing test**

```ts
/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/mythic/sessions/[id]/flow-key/revoke/route';

const rpcMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: rpcMock,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null }) }) }) }),
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }) },
  }),
}));

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});
beforeEach(() => jest.clearAllMocks());

const req = () =>
  new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/revoke', {
    method: 'POST',
    headers: { authorization: 'Bearer t' },
  });

describe('POST .../flow-key/revoke', () => {
  it('401 without auth', async () => {
    const res = await POST(
      new NextRequest('https://test.vercel.app/api/mythic/sessions/s1/flow-key/revoke', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 's1' }) }
    );
    expect(res.status).toBe(401);
  });

  it('voids the open drain', async () => {
    rpcMock.mockResolvedValue({ data: { revoked: true, spore_id: 'sp1' }, error: null });
    const res = await POST(req(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ revoked: true, spore_id: 'sp1' });
    expect(rpcMock).toHaveBeenCalledWith('revoke_flow_key', { p_session_id: 's1' });
  });

  it('is a no-op when no drain is open', async () => {
    rpcMock.mockResolvedValue({ data: { revoked: false }, error: null });
    const res = await POST(req(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(200);
    expect((await res.json()).revoked).toBe(false);
  });

  it('403 for a non-host', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Not authorized', code: '42501' } });
    const res = await POST(req(), { params: Promise.resolve({ id: 's1' }) });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-revoke-route.test.ts`
Expected: FAIL — cannot resolve the revoke route module

- [ ] **Step 4: Write minimal implementation**

```ts
// src/app/api/mythic/sessions/[id]/flow-key/revoke/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '../../../_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    const { data, error } = await ctx.sb.rpc('revoke_flow_key', { p_session_id: id });
    if (error) {
      if (error.message.includes('Not authorized')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'flow-key:revoke');
  }
}
```

```ts
// src/app/api/cron/flow-key-reap/route.ts
// Replace the auth guard with the exact pattern read in Step 1.
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sb = createServerClient();
    const { data, error } = await sb.rpc('reap_stale_flow_drains');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ voided: data ?? 0 });
  } catch (error) {
    return handleApiError(error, 'flow-key:reap');
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-revoke-route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/mythic/sessions/[id]/flow-key/revoke/route.ts" src/app/api/cron/flow-key-reap/route.ts src/__tests__/flow-key-revoke-route.test.ts
git commit -m "feat(flow-key): revoke route + stale-drain reaper cron"
```

---

### Task 9: Single-use download grant + `.well-known` public keys

**Files:**
- Create: `src/app/api/flow-spores/[id]/grant/route.ts`
- Create: `src/app/api/flow-spores/[id]/download/route.ts`
- Create: `src/app/.well-known/mixhive-flow-key.json/route.ts`
- Test: `src/__tests__/flow-key-download-route.test.ts`

**Interfaces:**
- Consumes: `flow_spore_grants` (Task 4), `loadVerificationKeys` (Task 2).
- Produces: `POST grant` → `{ token, download_url, expires_in_seconds: 600 }` (token returned once, only the sha256 is stored); `GET download?token=` → the spore document, or 410 on reuse; `GET .well-known` → `{ algorithm: 'ed25519', keys: [{ key_id, public_key_pem }] }`.
- Copy the token semantics **exactly** from `src/app/api/mythic/sessions/[id]/handoff/route.ts`: `randomBytes(24).toString('base64url')`, sha256 stored, conditional update guarding `used_at is null` and `expires_at > now()`, 410 when the guard matches nothing.

- [ ] **Step 1: Write the failing test**

```ts
/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */

import { NextRequest } from 'next/server';

const updateResult = { data: null as unknown, error: null as unknown };
const fromMock = jest.fn();

function grantChain() {
  const chain: Record<string, unknown> = {};
  const pass = () => chain;
  chain.update = pass;
  chain.eq = pass;
  chain.is = pass;
  chain.gt = pass;
  chain.select = pass;
  chain.maybeSingle = () => ({
    then: (resolve: Function) => resolve({ data: updateResult.data, error: null }),
  });
  return chain;
}

jest.mock('@/lib/supabase', () => ({
  createServerClient: () => ({
    from: fromMock,
    storage: {
      from: () => ({
        download: jest
          .fn()
          .mockResolvedValue({ data: { text: async () => '{"genome":{}}' }, error: null }),
      }),
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  fromMock.mockImplementation((table: string) => {
    if (table === 'flow_spore_grants') return grantChain();
    if (table === 'flow_spores')
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => ({
              then: (r: Function) => r({ data: { storage_path: 's1/sp1.json' }, error: null }),
            }),
          }),
        }),
      };
    return grantChain();
  });
});

describe('GET /api/flow-spores/[id]/download', () => {
  it('400 without a token', async () => {
    const { GET } = await import('@/app/api/flow-spores/[id]/download/route');
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/flow-spores/sp1/download'),
      { params: Promise.resolve({ id: 'sp1' }) }
    );
    expect(res.status).toBe(400);
  });

  it('returns the spore document for a fresh token', async () => {
    updateResult.data = { id: 'g1' };
    const { GET } = await import('@/app/api/flow-spores/[id]/download/route');
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/flow-spores/sp1/download?token=abc'),
      { params: Promise.resolve({ id: 'sp1' }) }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ genome: {} });
  });

  it('410 when the token was already used or expired', async () => {
    updateResult.data = null;
    const { GET } = await import('@/app/api/flow-spores/[id]/download/route');
    const res = await GET(
      new NextRequest('https://test.vercel.app/api/flow-spores/sp1/download?token=abc'),
      { params: Promise.resolve({ id: 'sp1' }) }
    );
    expect(res.status).toBe(410);
  });
});

describe('GET /.well-known/mixhive-flow-key.json', () => {
  it('publishes the seal public key without ever exposing the private key', async () => {
    const { generateSealKeyPair } = await import('@/lib/flow-key/seal');
    const { privateKeyPem } = generateSealKeyPair();
    process.env.FLOW_KEY_SEAL_KEY = privateKeyPem;
    process.env.FLOW_KEY_SEAL_KEY_ID = 'fk-test';
    const { GET } = await import('@/app/.well-known/mixhive-flow-key.json/route');
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.algorithm).toBe('ed25519');
    expect(body.keys[0]).toMatchObject({ key_id: 'fk-test' });
    expect(body.keys[0].public_key_pem).toContain('BEGIN PUBLIC KEY');
    expect(JSON.stringify(body)).not.toContain('PRIVATE');
  });

  it('returns an empty key list rather than 500 when unconfigured', async () => {
    delete process.env.FLOW_KEY_SEAL_KEY;
    jest.resetModules();
    const { GET } = await import('@/app/.well-known/mixhive-flow-key.json/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).keys).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-download-route.test.ts`
Expected: FAIL — cannot resolve the download route module

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/flow-spores/[id]/grant/route.ts
import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-errors';
import { ritualAuth } from '@/app/api/mythic/sessions/_lib';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await ritualAuth(req);
    if (!ctx) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const { id } = await params;

    // RLS already restricts flow_spores SELECT to the turner and contributors,
    // so an invisible spore reads as not-found rather than forbidden.
    const { data: spore } = await ctx.sb
      .from('flow_spores')
      .select('id, state')
      .eq('id', id)
      .maybeSingle();
    if (!spore) return NextResponse.json({ error: 'Spore not found' }, { status: 404 });
    if (spore.state !== 'sealed') {
      return NextResponse.json({ error: 'Spore is not sealed' }, { status: 409 });
    }

    const token = randomBytes(24).toString('base64url');
    const { error } = await ctx.sb.from('flow_spore_grants').insert({
      spore_id: id,
      issued_by: ctx.user.id,
      rights: ['read'],
      token_hash: createHash('sha256').update(token).digest('hex'),
      expires_at: new Date(Date.now() + 600_000).toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      token,
      download_url: `/api/flow-spores/${id}/download?token=${encodeURIComponent(token)}`,
      expires_in_seconds: 600,
    });
  } catch (error) {
    return handleApiError(error, 'flow-spore:grant');
  }
}
```

```ts
// src/app/api/flow-spores/[id]/download/route.ts
import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

    const sb = createServerClient();
    const now = new Date().toISOString();

    // Single-use: the conditional update is the guard. Same semantics as the
    // proven ritual handoff route.
    const { data: grant } = await sb
      .from('flow_spore_grants')
      .update({ used_at: now })
      .eq('spore_id', id)
      .eq('token_hash', createHash('sha256').update(token).digest('hex'))
      .is('used_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .select('id')
      .maybeSingle();

    if (!grant) {
      return NextResponse.json(
        { error: 'Grant expired, revoked, or already used' },
        { status: 410 }
      );
    }

    const { data: spore } = await sb
      .from('flow_spores')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();
    if (!spore?.storage_path) {
      return NextResponse.json({ error: 'Spore document missing' }, { status: 404 });
    }

    const { data: file, error } = await sb.storage
      .from('flow-spores')
      .download(spore.storage_path as string);
    if (error || !file) {
      return NextResponse.json({ error: 'Spore document unreadable' }, { status: 500 });
    }

    return new NextResponse(await file.text(), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error, 'flow-spore:download');
  }
}
```

```ts
// src/app/.well-known/mixhive-flow-key.json/route.ts
import { NextResponse } from 'next/server';
import { loadVerificationKeys } from '@/lib/flow-key/seal';

// Public: this is what makes a spore verifiable offline by anyone.
export async function GET() {
  const keys = loadVerificationKeys().map(k => ({
    key_id: k.keyId,
    public_key_pem: k.publicKeyPem,
  }));
  return NextResponse.json(
    { algorithm: 'ed25519', canonicalization: 'RFC8785', keys },
    { headers: { 'cache-control': 'public, max-age=300' } }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-download-route.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/flow-spores/[id]" "src/app/.well-known" src/__tests__/flow-key-download-route.test.ts
git commit -m "feat(flow-key): single-use download grant + public seal keys"
```

---

### Task 10: `FlowKeyGlyph` component

**Files:**
- Create: `src/components/FlowKeyGlyph.tsx`
- Test: `src/__tests__/FlowKeyGlyph.test.tsx`

**Interfaces:**
- Consumes: `colors`, `space`, `fontSize`, `transition` from `@/styles/tokens`.
- Produces: `<FlowKeyGlyph capped={number} skipped={number} isOpen={boolean} canTurn={boolean} onTurn={() => void} busy={boolean} />`.

Not a `HexCell` — that component is a track card. This draws its own 28px hexagon.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowKeyGlyph } from '@/components/FlowKeyGlyph';

describe('FlowKeyGlyph', () => {
  it('renders a real button for a host who can turn it', () => {
    render(<FlowKeyGlyph capped={3} skipped={2} isOpen={false} canTurn onTurn={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('states the capped count in plain language, no jargon', () => {
    render(<FlowKeyGlyph capped={3} skipped={2} isOpen={false} canTurn onTurn={() => {}} />);
    expect(screen.getByRole('button')).toHaveAccessibleName(/3 of 5 cells capped/i);
  });

  it('renders a non-interactive status glyph for the audience', () => {
    render(<FlowKeyGlyph capped={3} skipped={2} isOpen={false} canTurn={false} onTurn={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('announces the drain politely while open, never blocking', () => {
    render(<FlowKeyGlyph capped={3} skipped={0} isOpen canTurn={false} onTurn={() => {}} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent(/comb draining/i);
  });

  it('calls onTurn when the host activates it', async () => {
    const onTurn = jest.fn();
    render(<FlowKeyGlyph capped={1} skipped={0} isOpen={false} canTurn onTurn={onTurn} />);
    await userEvent.click(screen.getByRole('button'));
    expect(onTurn).toHaveBeenCalledTimes(1);
  });

  it('disables the turn when nothing is capped, and says why', () => {
    render(<FlowKeyGlyph capped={0} skipped={2} isOpen={false} canTurn onTurn={() => {}} />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleName(/nothing's capped yet/i);
  });

  it('disables the turn while a drain is already open', () => {
    render(<FlowKeyGlyph capped={3} skipped={0} isOpen canTurn onTurn={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables the turn while busy', () => {
    render(<FlowKeyGlyph capped={3} skipped={0} isOpen={false} canTurn busy onTurn={() => {}} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/FlowKeyGlyph.test.tsx`
Expected: FAIL — `Cannot find module '@/components/FlowKeyGlyph'`

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

import React from 'react';
import { colors, fontSize, space, transition } from '@/styles/tokens';

export interface FlowKeyGlyphProps {
  capped: number;
  skipped: number;
  isOpen: boolean;
  canTurn: boolean;
  busy?: boolean;
  onTurn: () => void;
}

const SIZE = 28;
// Flat-top hexagon, matching the hive language elsewhere in the app.
const POINTS = '25,2 75,2 98,50 75,98 25,98 2,50';

function Hexagon({ open }: { open: boolean }) {
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      style={{
        // The 90-degree turn. Under reduced motion the rotation is suppressed
        // and the split line alone carries the state change.
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: `transform ${transition.base}`,
      }}
    >
      <polygon
        points={POINTS}
        fill={open ? colors.accent : 'transparent'}
        stroke={open ? colors.accent : colors.border}
        strokeWidth={6}
      />
      {open && <line x1="50" y1="8" x2="50" y2="92" stroke={colors.bg} strokeWidth={8} />}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          svg { transition: none !important; transform: none !important; }
        }
      `}</style>
    </svg>
  );
}

export function FlowKeyGlyph({
  capped,
  skipped,
  isOpen,
  canTurn,
  busy = false,
  onTurn,
}: FlowKeyGlyphProps) {
  const total = capped + skipped;
  const label = isOpen
    ? 'Flow Key turned — comb draining'
    : capped === 0
      ? "Flow Key — nothing's capped yet"
      : `Turn the Flow Key — ${capped} of ${total} cells capped`;

  const wrap: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: space.xs,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  };

  if (!canTurn) {
    return (
      <span role="status" aria-live="polite" style={wrap}>
        <Hexagon open={isOpen} />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onTurn}
      disabled={busy || isOpen || capped === 0}
      aria-label={label}
      style={{
        ...wrap,
        background: 'transparent',
        border: 'none',
        padding: space.xs,
        cursor: busy || isOpen || capped === 0 ? 'default' : 'pointer',
      }}
    >
      <Hexagon open={isOpen} />
      <span aria-hidden="true">
        {isOpen ? 'draining' : capped === 0 ? 'nothing capped' : `${capped}/${total}`}
      </span>
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/__tests__/FlowKeyGlyph.test.tsx`
Expected: PASS (8 tests)

If `colors.textMuted`, `colors.bg`, `colors.border`, `colors.accent`, `space.xs`, `fontSize.xs`, or `transition.base` do not exist, run `grep -n "textMuted\|accent\|border" src/styles/tokens.ts` and substitute the real token names. **Do not introduce a hex literal** — ESLint will fail the build.

- [ ] **Step 5: Commit**

```bash
git add src/components/FlowKeyGlyph.tsx src/__tests__/FlowKeyGlyph.test.tsx
git commit -m "feat(flow-key): FlowKeyGlyph — ambient 90-degree turn, a11y, reduced motion"
```

---

### Task 11: Wire the glyph into `MythicSessionRoom`

**Files:**
- Modify: `src/lib/rituals.ts` (add `created_at` to `RitualAsset`; add `FlowKeyState` type and helpers)
- Modify: `src/components/MythicSessionRoom.tsx` (mount the glyph in the header, near the existing `isCreator` controls around lines 356–380)
- Test: `src/__tests__/flow-key-room-wiring.test.tsx`

**Interfaces:**
- Consumes: `FlowKeyGlyph` (Task 10), `ritualRequest` from `@/lib/rituals`, the `flow-key` routes (Tasks 6–8).
- Produces: `interface FlowKeyState { is_open: boolean; opened_at: string | null; turns_count: number; spore_id: string | null; capped: number; skipped: number }` exported from `src/lib/rituals.ts`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FlowKeyTap } from '@/components/FlowKeyTap';

const ritualRequest = jest.fn();
jest.mock('@/lib/rituals', () => ({
  ritualRequest: (...args: unknown[]) => ritualRequest(...args),
}));
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('FlowKeyTap', () => {
  it('loads tap state and renders the capped count', async () => {
    ritualRequest.mockResolvedValue({
      is_open: false,
      opened_at: null,
      turns_count: 0,
      spore_id: null,
      capped: 2,
      skipped: 1,
    });
    render(<FlowKeyTap sessionId="s1" isCreator />);
    await waitFor(() =>
      expect(screen.getByRole('button')).toHaveAccessibleName(/2 of 3 cells capped/i)
    );
  });

  it('turns the key, then seals, without unmounting the room', async () => {
    ritualRequest
      .mockResolvedValueOnce({
        is_open: false,
        opened_at: null,
        turns_count: 0,
        spore_id: null,
        capped: 2,
        skipped: 0,
      })
      .mockResolvedValueOnce({ spore_id: 'sp1', capped: 2, skipped: 0, turns_count: 1 })
      .mockResolvedValueOnce({ spore_id: 'sp1', content_hash: 'a'.repeat(64), capped: 2 })
      .mockResolvedValue({
        is_open: false,
        opened_at: null,
        turns_count: 1,
        spore_id: null,
        capped: 2,
        skipped: 0,
      });

    render(<FlowKeyTap sessionId="s1" isCreator />);
    await waitFor(() => expect(screen.getByRole('button')).toBeEnabled());
    await userEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(ritualRequest).toHaveBeenCalledWith(
        '/api/mythic/sessions/s1/flow-key',
        expect.objectContaining({ method: 'POST' })
      )
    );
    await waitFor(() =>
      expect(ritualRequest).toHaveBeenCalledWith(
        '/api/mythic/sessions/s1/flow-key/seal',
        expect.objectContaining({ method: 'POST' })
      )
    );
  });

  it('surfaces nothing_capped as an ambient state, not a thrown error', async () => {
    ritualRequest.mockResolvedValue({
      is_open: false,
      opened_at: null,
      turns_count: 0,
      spore_id: null,
      capped: 0,
      skipped: 2,
    });
    render(<FlowKeyTap sessionId="s1" isCreator />);
    await waitFor(() => expect(screen.getByRole('button')).toBeDisabled());
    expect(screen.getByRole('button')).toHaveAccessibleName(/nothing's capped yet/i);
  });

  it('renders a status glyph, not a button, for the audience', async () => {
    ritualRequest.mockResolvedValue({
      is_open: true,
      opened_at: '2026-07-30T22:00:00.000Z',
      turns_count: 1,
      spore_id: 'sp1',
      capped: 2,
      skipped: 0,
    });
    render(<FlowKeyTap sessionId="s1" isCreator={false} />);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/comb draining/i));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/__tests__/flow-key-room-wiring.test.tsx`
Expected: FAIL — `Cannot find module '@/components/FlowKeyTap'`

- [ ] **Step 3: Write minimal implementation**

`MythicSessionRoom.tsx` is already 697 lines; the fetch/turn/seal logic goes in its own container component rather than growing that file further.

```tsx
// src/components/FlowKeyTap.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ritualRequest, type FlowKeyState } from '@/lib/rituals';
import { FlowKeyGlyph } from '@/components/FlowKeyGlyph';

export function FlowKeyTap({ sessionId, isCreator }: { sessionId: string; isCreator: boolean }) {
  const [state, setState] = useState<FlowKeyState | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await ritualRequest<FlowKeyState>(`/api/mythic/sessions/${sessionId}/flow-key`));
    } catch {
      // The tap is ambient. A failed poll must never interrupt the ritual.
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const turn = useCallback(async () => {
    setBusy(true);
    try {
      const turned = await ritualRequest<{ spore_id: string }>(
        `/api/mythic/sessions/${sessionId}/flow-key`,
        { method: 'POST' }
      );
      // Snapshot-on-turn: seal immediately. The drain is not a live stream.
      await ritualRequest(`/api/mythic/sessions/${sessionId}/flow-key/seal`, {
        method: 'POST',
        body: JSON.stringify({ spore_id: turned.spore_id }),
      });
      toast.success('Comb drained — spore sealed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The key would not turn');
    } finally {
      setBusy(false);
      void load();
    }
  }, [sessionId, load]);

  if (!state) return null;

  return (
    <FlowKeyGlyph
      capped={state.capped}
      skipped={state.skipped}
      isOpen={state.is_open}
      canTurn={isCreator}
      busy={busy}
      onTurn={() => void turn()}
    />
  );
}
```

In `src/lib/rituals.ts`, add `created_at: string;` to `RitualAsset` and append:

```ts
export interface FlowKeyState {
  is_open: boolean;
  opened_at: string | null;
  turns_count: number;
  spore_id: string | null;
  capped: number;
  skipped: number;
}
```

- [ ] **Step 4: Mount it in the room**

In `src/components/MythicSessionRoom.tsx`, import `FlowKeyTap` and render it in the header row beside the existing creator controls (the `isCreator &&` block near line 356). It must be non-blocking and must not be inside a modal:

```tsx
<FlowKeyTap sessionId={sessionId} isCreator={isCreator} />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/__tests__/flow-key-room-wiring.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Verify the whole suite and the build**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```

All four must pass. Note: per `docs/superpowers/specs` project history, `tsc` may be unreliable in this repo — if it emits pre-existing errors unrelated to `src/lib/flow-key/**` or `src/components/FlowKey*`, record them and proceed; do not "fix" unrelated files in this branch.

- [ ] **Step 7: Verify 320px and reduced motion**

```bash
npm run build && npm run preview -- -p 3002
npm run smoke -- --mock-supabase http://127.0.0.1:3002
```

Expected: no horizontal overflow at 320px, no new console errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/FlowKeyTap.tsx src/components/MythicSessionRoom.tsx src/lib/rituals.ts src/__tests__/flow-key-room-wiring.test.tsx
git commit -m "feat(flow-key): mount the tap in the ritual room"
```

---

### Task 12: Codex handoff note (infra — do not patch)

**Files:**
- Create: `docs/FLOW_KEY_CODEX_HANDOFF.md`

`vercel.json` and `.github/workflows/*` are Codex-owned per `CLAUDE.md`. This task writes the request down instead of editing them.

- [ ] **Step 1: Write the handoff**

```markdown
# Flow Key FK-1 — Codex handoff

Claude Code implemented FK-1 (`docs/superpowers/plans/2026-07-30-flow-key-fk1-spine.md`).
Three infra items are Codex-owned and were deliberately not patched.

## 1. Cron: stale-drain reaper

`vercel.json` needs:

```json
{ "path": "/api/cron/flow-key-reap", "schedule": "*/5 * * * *" }
```

Every five minutes. Voids draining spores older than 15 minutes and closes their
taps, so a session is never left with a stuck-open Flow Key. Authenticated with
the existing `CRON_SECRET`.

## 2. Environment variables (Vercel, server-only)

| Name | Value | Notes |
|---|---|---|
| `FLOW_KEY_SEAL_KEY` | Ed25519 PKCS#8 PEM private key | **Server-only. Never `NEXT_PUBLIC_`.** Generate with the snippet below. |
| `FLOW_KEY_SEAL_KEY_ID` | e.g. `fk-2026-07` | Identifies which key signed a spore. |
| `FLOW_KEY_SEAL_KEY_PREVIOUS` | previous **public** key PEM | Optional; only needed after a rotation. |
| `FLOW_KEY_SEAL_KEY_PREVIOUS_ID` | e.g. `fk-2026-01` | Optional. |

```bash
node -e "const{generateKeyPairSync}=require('node:crypto');const{privateKey}=generateKeyPairSync('ed25519');console.log(privateKey.export({type:'pkcs8',format:'pem'}).toString())"
```

Without `FLOW_KEY_SEAL_KEY` the seal route fails closed and
`/.well-known/mixhive-flow-key.json` returns an empty key list. Turning the key
is then impossible — which is the correct failure mode, since an unsigned spore
is worthless.

## 3. Migration 119

`supabase/migrations/119_flow_key_spine.sql` — new tables, RLS, two extended
check constraints (`mythic_nodes.node_type`, `mythic_edges.edge_type`), four
RPCs, and the private `flow-spores` storage bucket.

**Before applying to production**, confirm the constraint replacements retain
every pre-existing enum value:

```bash
psql "$PROD_URL" -c "\d+ public.mythic_edges" | grep edge_type_check
```

The new list must contain all 16 prior types plus `drained_from` and
`germinated_into`. Verified idempotent by running the file twice against a
scratch database.
```

- [ ] **Step 2: Commit**

```bash
git add docs/FLOW_KEY_CODEX_HANDOFF.md
git commit -m "docs(flow-key): Codex handoff — cron, env, migration 119"
```

---

## Self-Review

**Spec coverage:** §5 capping → Task 3. §6.1–6.4 tables → Task 4. §6.7 graph → Task 4. §6.8 storage → Task 7 Step 5. §7 RPCs 1/2/4/6 → Task 4 (RPC 3 `germinate` and RPC 5 `countersign` are **FK-2**, correctly out of scope). §8 API turn/seal/state/revoke/download/well-known → Tasks 6–9. §9 Layer A → Tasks 1, 2, 5. §10 glyph → Tasks 10, 11. §11 error handling → covered by tests in Tasks 6, 8, 9, 10. §12 testing → every task.

**Known gaps, deliberate:** the `POST grant` route ships in Task 9 but has no UI; the `SporeCard` surface is FK-2. Per-asset `digest` reads from `collab_session_assets.metadata.digest`, which the audio worker may not populate yet — Task 5 tolerates an empty digest, and backfilling it is FK-2 work. Layers B/C/D of §9 are FK-2/FK-3.

**Type consistency:** `CappableAsset` (Task 3) is extended by `SporeAsset` (Task 5). `selectCappedCells` returns `{capped, skipped}` in Tasks 3, 5, 6. `loadSealKey()` returns `{privateKeyPem, publicKeyPem, keyId}` in Tasks 2, 7. `FlowKeyState` (Task 11) matches the `GET` payload in Task 6. `signGenome(hash, privateKeyPem)` is two-arg everywhere.
