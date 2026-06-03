import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { create_collab_session, end_collab_session } from '@/lib/database-queries';
import { z } from 'zod';
import { handleApiError, unauthorized, badRequest } from '@/lib/api-errors';
import { getUserVariant } from '@/lib/experiments';

const CreateSessionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  isPublic: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = await request.json();
    const parsed = CreateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return badRequest(parsed.error.flatten().fieldErrors);
    }

    const session = await create_collab_session({
      title: parsed.data.title,
      description: parsed.data.description,
      isPublic: parsed.data.isPublic,
    });

    // Fire-and-forget experiment event
    void supabase.from('experiment_events').insert({
      profile_id: user.id,
      event_type: 'collab_session_started',
      feature: 'collab_sessions',
      variant: getUserVariant(user.id, 'collab_sessions'),
      properties: { session_id: session.id, participant_count: 1 },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'sessions:create');
  }
}

// End a session
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return badRequest({ sessionId: ['sessionId is required'] });
    }

    await end_collab_session(sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'sessions:end');
  }
}
