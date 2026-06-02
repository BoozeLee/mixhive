// Vector embedding + similarity search tools.
// Embeds text via OpenAI, stores + searches in the ai_embeddings table.

import { createClient } from '@supabase/supabase-js';

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function embed(text: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured for embeddings');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`embed request failed: ${res.status}`);
  const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return data.data[0].embedding;
}

export const vectorTools = {
  'vector.embed': async (text: string): Promise<number[]> => {
    return embed(text);
  },

  'vector.search': async (
    embedding: number[],
    entityType: string,
    limit = 10,
    threshold = 0.65
  ): Promise<Array<Record<string, unknown>>> => {
    const supabase = adminClient();
    // Use pgvector <=> (cosine distance) operator via raw SQL
    const vecStr = `[${embedding.join(',')}]`;
    const { data, error } = await supabase.rpc('match_ai_embeddings', {
      p_entity_type: entityType,
      p_embedding: vecStr,
      p_threshold: threshold,
      p_limit: limit,
    });
    if (error) {
      // Fallback: if RPC not available, return empty
      console.warn('vector.search RPC error, returning empty:', error.message);
      return [];
    }
    return (data ?? []) as Array<Record<string, unknown>>;
  },

  'vector.upsert': async (
    entityType: string,
    entityId: string,
    text: string,
    ownerId?: string
  ): Promise<boolean> => {
    const embedding = await embed(text);
    const supabase = adminClient();
    const { error } = await supabase.from('ai_embeddings').upsert({
      owner_id: ownerId ?? null,
      entity_type: entityType,
      entity_id: entityId,
      embedding: `[${embedding.join(',')}]`,
      model: 'text-embedding-3-small',
      version: 1,
    });
    if (error) throw new Error(`vector.upsert: ${error.message}`);
    return true;
  },
};
