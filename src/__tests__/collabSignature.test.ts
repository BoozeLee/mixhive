import { computeCollabEdgeSignature } from '../lib/collabSignature';

describe('computeCollabEdgeSignature', () => {
  const secret = 'test-secret';
  const session = 'sess-1';
  const ended = '2026-06-12T00:00:00.000Z';

  it('is deterministic and a 64-char hex digest', () => {
    const a = computeCollabEdgeSignature(['u1', 'u2'], session, ended, secret);
    const b = computeCollabEdgeSignature(['u1', 'u2'], session, ended, secret);
    expect(a.signature).toBe(b.signature);
    expect(a.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is order-independent (participants are sorted before signing)', () => {
    const a = computeCollabEdgeSignature(['u1', 'u2'], session, ended, secret);
    const b = computeCollabEdgeSignature(['u2', 'u1'], session, ended, secret);
    expect(a.signature).toBe(b.signature);
  });

  it('reports participant_count and signed_at', () => {
    const r = computeCollabEdgeSignature(['u1', 'u2', 'u3'], session, ended, secret);
    expect(r.participant_count).toBe(3);
    expect(r.signed_at).toBe(ended);
  });

  it('changes when any input changes', () => {
    const base = computeCollabEdgeSignature(['u1', 'u2'], session, ended, secret).signature;
    expect(computeCollabEdgeSignature(['u1', 'u3'], session, ended, secret).signature).not.toBe(
      base
    );
    expect(computeCollabEdgeSignature(['u1', 'u2'], 'sess-2', ended, secret).signature).not.toBe(
      base
    );
    expect(
      computeCollabEdgeSignature(['u1', 'u2'], session, '2026-01-01T00:00:00.000Z', secret)
        .signature
    ).not.toBe(base);
    expect(computeCollabEdgeSignature(['u1', 'u2'], session, ended, 'other').signature).not.toBe(
      base
    );
  });
});
