import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { embedAndStoreEntity } from '@/lib/embed-entity';
import { handleApiError } from '@/lib/api-errors';

// Daily cron at 03:00 UTC (vercel.json: { "path": "/api/cron/embed-refresh", "schedule": "0 3 * * *" })
// Refreshes stale embeddings (>7 days old), then computes profile_snapshot centroids for
// profiles with ≥3 published mixes. Max 200 rows per run to stay within 60s Vercel limit.

const STALE_DAYS = 7;
const BATCH_LIMIT = 200;
const SNAPSHOT_TRIGGER_MIXES = 3;

interface MixRow {
  entity_id: string;
  owner_id: string | null;
}
interface ProfileRow {
  entity_id: string;
  owner_id: string | null;
}

function buildMixText(mix: Record<string, unknown>): string {
  const parts: string[] = [];
  if (mix.title) parts.push(String(mix.title));
  if (mix.description) parts.push(String(mix.description));
  if (Array.isArray(mix.genre_tags)) parts.push(mix.genre_tags.join(' '));
  if (mix.genre) parts.push(String(mix.genre));
  return parts.join(' ').trim();
}

function buildProfileText(profile: Record<string, unknown>): string {
  const parts: string[] = [];
  if (profile.bio) parts.push(String(profile.bio));
  if (Array.isArray(profile.genre_tags)) parts.push(profile.genre_tags.join(' '));
  if (Array.isArray(profile.scene_tags)) parts.push(profile.scene_tags.join(' '));
  if (profile.city) parts.push(String(profile.city));
  return parts.join(' ').trim();
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();

    // Fetch stale mix and profile embeddings
    const { data: staleRows, error } = await supabase
      .from('ai_embeddings')
      .select('entity_type, entity_id, owner_id')
      .in('entity_type', ['mix', 'profile'])
      .lt('updated_at', cutoff)
      .limit(BATCH_LIMIT);

    if (error) throw error;

    const rows = (staleRows ?? []) as Array<{
      entity_type: string;
      entity_id: string;
      owner_id: string | null;
    }>;

    let refreshed = 0;
    const profileIds = new Set<string>();

    for (const row of rows) {
      if (row.entity_type === 'mix') {
        const { data: mix } = await supabase
          .from('mixes')
          .select('title, description, genre, genre_tags')
          .eq('id', row.entity_id)
          .single();
        if (mix) {
          const text = buildMixText(mix as Record<string, unknown>);
          if (text) {
            await embedAndStoreEntity('mix', row.entity_id, text, row.owner_id ?? undefined);
            refreshed++;
          }
        }
      } else if (row.entity_type === 'profile') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('bio, genre_tags, scene_tags, city')
          .eq('id', row.entity_id)
          .single();
        if (profile) {
          const text = buildProfileText(profile as Record<string, unknown>);
          if (text) {
            await embedAndStoreEntity('profile', row.entity_id, text, row.entity_id);
            refreshed++;
            profileIds.add(row.entity_id);
          }
        }
      }
    }

    // Compute profile_snapshot centroids for refreshed profiles with ≥3 mixes
    let snapshots = 0;
    for (const profileId of profileIds) {
      const { data: mixes } = await supabase
        .from('mixes')
        .select('id, created_at')
        .eq('user_id', profileId)
        .eq('is_published', true)
        .order('created_at', { ascending: true });

      if (!mixes || mixes.length < SNAPSHOT_TRIGGER_MIXES) continue;

      const third = Math.floor(mixes.length / 3);
      const windows = [
        mixes.slice(0, third),
        mixes.slice(third, 2 * third),
        mixes.slice(2 * third),
      ];

      for (let idx = 0; idx < 3; idx++) {
        const windowMixes = windows[idx];
        const mixIds = windowMixes.map((m: { id: string }) => m.id);

        const { data: embedRows } = await supabase
          .from('ai_embeddings')
          .select('embedding')
          .eq('entity_type', 'mix')
          .in('entity_id', mixIds);

        if (!embedRows || embedRows.length === 0) continue;

        // Centroid: mean of embeddings (stored as JSON array)
        const dim = 1536;
        const centroid = new Array<number>(dim).fill(0);
        for (const row of embedRows) {
          const vec = row.embedding as number[];
          for (let d = 0; d < dim; d++) {
            centroid[d] += (vec[d] ?? 0) / embedRows.length;
          }
        }

        const entityKey = `profile_snapshot:${profileId}:${idx + 1}`;
        await supabase.from('ai_embeddings').upsert(
          {
            entity_type: 'profile_snapshot',
            entity_id: profileId,
            entity_key: entityKey,
            embedding: centroid,
            owner_id: profileId,
            metadata: {
              snapshot_index: idx + 1,
              mix_count: windowMixes.length,
              period_start: windowMixes[0]?.created_at ?? null,
              period_end: windowMixes[windowMixes.length - 1]?.created_at ?? null,
            },
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'entity_key' }
        );
        snapshots++;
      }
    }

    return NextResponse.json({ refreshed, snapshots });
  } catch (err) {
    return handleApiError(err);
  }
}
