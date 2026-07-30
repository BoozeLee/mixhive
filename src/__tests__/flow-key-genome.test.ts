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
