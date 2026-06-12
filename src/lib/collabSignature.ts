import { createHmac } from 'node:crypto';

export interface CollabSignature {
  /** HMAC-SHA256 hex digest attesting the participant set of a collab session. */
  signature: string;
  /** ISO timestamp the signature was minted (the session end time). */
  signed_at: string;
  participant_count: number;
}

/**
 * Deterministic HMAC-SHA256 over the canonical
 * `{ participants: sorted(ids), session_id, ended_at }`.
 *
 * Server-only: the secret never reaches the client, and `mythic_edges` has no client
 * write RLS policy — so a signature present on a `collab_with` edge proves it was minted
 * by the trusted post-session job for the real (DB-sourced) participant set. This is the
 * first step toward portable, verifiable co-production claims (OMNINOVATOR Path 3).
 */
export function computeCollabEdgeSignature(
  participantIds: string[],
  sessionId: string,
  endedAt: string,
  secret: string
): CollabSignature {
  const participants = [...participantIds].sort();
  const payload = JSON.stringify({ participants, session_id: sessionId, ended_at: endedAt });
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return { signature, signed_at: endedAt, participant_count: participants.length };
}
