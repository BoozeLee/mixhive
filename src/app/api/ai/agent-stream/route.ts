import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CACHE_TTL_MS = 3_600_000; // 1 hour

function isMissingTable(error: { code?: string; message?: string } | null | undefined) {
  return error?.code === '42P01' || /Could not find the table/i.test(error?.message || '');
}

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Supabase not configured', { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Not authenticated', { status: 401 });
  }

  const body = await req.json();
  const { agentId, mixId, context, bustCache } = body as {
    agentId?: string;
    mixId?: string;
    context?: Record<string, unknown>;
    bustCache?: boolean;
  };

  if (!mixId || !UUID_RE.test(mixId)) {
    return new Response('Invalid mixId', { status: 400 });
  }

  const jwt = authHeader.slice(7);
  const sb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();
  if (authError || !user) return new Response('Invalid session', { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const { data: feature, error: featErr } = await sb
          .from('audio_features')
          .select('*')
          .eq('mix_id', mixId)
          .maybeSingle();

        if (featErr && !isMissingTable(featErr)) {
          send('error', { message: 'Failed to load audio features' });
          controller.close();
          return;
        }

        send('features', { feature: feature ?? null });

        const resolvedAgentId = agentId ?? 'dj_set_analyzer';

        if (!bustCache) {
          const { data: stateRow } = await sb
            .from('agent_state_user')
            .select('state_json')
            .eq('user_id', user.id)
            .eq('agent_id', resolvedAgentId)
            .maybeSingle();

          const cached = (stateRow?.state_json as Record<string, unknown> | undefined)
            ?.mix_cache as
            | Record<string, { suggestions: unknown[]; cached_at: string }>
            | undefined;

          const entry = cached?.[mixId];
          if (entry && Date.now() - new Date(entry.cached_at).getTime() < CACHE_TTL_MS) {
            send('status', { message: 'Loading cached analysis...' });
            send('suggestions', { suggestions: entry.suggestions });
            send('complete', { cached: true });
            controller.close();
            return;
          }
        }

        send('status', { message: 'Running AI analysis...' });

        const { data: mix } = await sb
          .from('mixes')
          .select('id, title, genre_name')
          .eq('id', mixId)
          .single();

        const agentCtx = {
          mix_id: mixId,
          mix_title: mix?.title ?? 'Unknown',
          genre: mix?.genre_name ?? null,
          audio_features: feature ?? null,
          ...(context ?? {}),
        };

        const agentRes = await fetch(
          `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/agents/test-run`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${jwt}`,
            },
            body: JSON.stringify({
              agent_id: resolvedAgentId,
              context: agentCtx,
              dry_run: false,
            }),
          }
        );

        if (!agentRes.ok) {
          const text = await agentRes.text().catch(() => '');
          send('error', { message: `Agent run failed: ${text}` });
          controller.close();
          return;
        }

        const agentOutput = await agentRes.json();

        const suggestions: unknown[] = agentOutput.suggestions ?? [];

        if (suggestions.length > 0) {
          send('suggestions', { suggestions });
        }

        send('complete', {});

        // Cache the result
        try {
          const { data: existingState } = await sb
            .from('agent_state_user')
            .select('state_json')
            .eq('user_id', user.id)
            .eq('agent_id', resolvedAgentId)
            .maybeSingle();

          const stateJson = ((existingState?.state_json as Record<string, unknown>) ??
            {}) as Record<string, unknown>;
          const mixCache = ((stateJson.mix_cache as Record<string, unknown>) ?? {}) as Record<
            string,
            unknown
          >;
          mixCache[mixId] = { suggestions, cached_at: new Date().toISOString() };
          stateJson.mix_cache = mixCache;

          await sb.from('agent_state_user').upsert(
            {
              user_id: user.id,
              agent_id: resolvedAgentId,
              state_json: stateJson,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id, agent_id' }
          );
        } catch {
          // cache write is best-effort
        }
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'Unknown error' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
