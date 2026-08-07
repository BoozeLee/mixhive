import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';
import { getUserVariant } from '@/lib/experiments';
import { createServerClient } from '@/lib/supabase';
import { ritualAuth } from './_lib';

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
  agentEnabled: z.boolean().optional().default(true),
  invitedCreatorIds: z.array(z.string().uuid()).max(5).optional().default([]),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await ritualAuth(request);
    if (!ctx) return unauthorized();

    const body = await request.json();
    const parsed = CreateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest('Invalid session', parsed.error.flatten().fieldErrors);
    }

    const { data: sessionId, error } = await ctx.sb.rpc('create_mythic_ritual', {
      p_title: parsed.data.title,
      p_description: parsed.data.description ?? null,
      p_is_public: parsed.data.isPublic,
      p_agent_enabled: parsed.data.agentEnabled,
      p_invited_creator_ids: parsed.data.invitedCreatorIds,
    });
    if (error || !sessionId) throw error ?? new Error('Failed to create session');

    // Fire-and-forget experiment event
    void createServerClient()
      .from('experiment_events')
      .insert({
        profile_id: ctx.user.id,
        event_type: 'collab_session_started',
        feature: 'collab_sessions',
        variant: getUserVariant(ctx.user.id, 'collab_sessions'),
        properties: { session_id: sessionId, participant_count: 1 },
      });

    return NextResponse.json({ id: sessionId }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'sessions:create');
  }
}

// End a session
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await ritualAuth(request);
    if (!ctx) return unauthorized();

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return badRequest('sessionId is required');
    }

    const { error } = await ctx.sb.rpc('end_collab_session', { p_session_id: sessionId });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'sessions:end');
  }
}
