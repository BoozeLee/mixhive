import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { embedAndStoreEntity } from '@/lib/embed-entity';
import { handleApiError } from '@/lib/api-errors';

// POST /api/embed
// Fire-and-forget embedding trigger called client-side after mix creation or
// profile update. Auth required. Returns 202 immediately; embedding is async.

type EntityType = 'mix' | 'profile';

export async function POST(req: Request) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { entity_type, entity_id } = (await req.json()) as {
      entity_type: EntityType;
      entity_id: string;
    };

    if (!entity_type || !entity_id) {
      return NextResponse.json({ error: 'entity_type and entity_id required' }, { status: 400 });
    }

    // Build text and embed without blocking the response
    (async () => {
      try {
        if (entity_type === 'mix') {
          const { data: mix } = await supabase
            .from('mixes')
            .select('title, description, genre, genre_tags')
            .eq('id', entity_id)
            .single();
          if (!mix) return;
          const parts: string[] = [];
          if (mix.title) parts.push(String(mix.title));
          if (mix.description) parts.push(String(mix.description));
          if (Array.isArray(mix.genre_tags)) parts.push(mix.genre_tags.join(' '));
          if (mix.genre) parts.push(String(mix.genre));
          const text = parts.join(' ').trim();
          if (text) await embedAndStoreEntity('mix', entity_id, text, user.id);
        } else if (entity_type === 'profile') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('bio, genre_tags, scene_tags, city')
            .eq('id', entity_id)
            .single();
          if (!profile) return;
          const parts: string[] = [];
          if (profile.bio) parts.push(String(profile.bio));
          if (Array.isArray(profile.genre_tags)) parts.push(profile.genre_tags.join(' '));
          if (Array.isArray(profile.scene_tags)) parts.push(profile.scene_tags.join(' '));
          if (profile.city) parts.push(String(profile.city));
          const text = parts.join(' ').trim();
          if (text) await embedAndStoreEntity('profile', entity_id, text, entity_id);
        }
      } catch {
        // silent — embedding failures never break the user flow
      }
    })();

    return NextResponse.json({ status: 'queued' }, { status: 202 });
  } catch (err) {
    return handleApiError(err);
  }
}
