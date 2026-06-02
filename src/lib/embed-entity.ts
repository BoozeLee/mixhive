// Fire-and-forget embedding helper for Phase 10 vector intelligence.
// Called from upload and profile-update routes; never blocks the main response.
//
// Uses the same OPENAI_API_KEY that vector.ts (Lua tools) uses. Upserts into
// ai_embeddings with entity_type/entity_id/entity_key matching existing schema
// from migrations 030/036.

import { createServerClient } from '@/lib/supabase';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;

async function fetchEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });

  if (!res.ok) {
    console.warn('[embed-entity] OpenAI embedding error', res.status);
    return null;
  }

  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data?.[0]?.embedding ?? null;
}

export async function embedAndStoreEntity(
  entityType: 'mix' | 'profile' | 'scene' | 'venue',
  entityId: string,
  text: string,
  ownerId?: string
): Promise<void> {
  const embedding = await fetchEmbedding(text);
  if (!embedding || embedding.length !== EMBEDDING_DIM) return;

  const supabase = createServerClient();
  const entityKey = `${entityType}:${entityId}`;

  await supabase.from('ai_embeddings').upsert(
    {
      entity_type: entityType,
      entity_id: entityId,
      entity_key: entityKey,
      embedding,
      owner_id: ownerId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'entity_key' }
  );
}
