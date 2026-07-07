import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    // Create Supabase client with service role for internal operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify service token
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const serviceToken = authHeader.substring(7);
    if (serviceToken !== process.env.SERVICE_ROLE_TOKEN) {
      return NextResponse.json({ error: 'Invalid service token' }, { status: 401 });
    }

    const { action_taken, flagged_by, payload } = await req.json();

    // Validate that at least one field is provided
    if (action_taken === undefined && flagged_by === undefined && payload === undefined) {
      return NextResponse.json(
        {
          error:
            'At least one field must be provided for update: action_taken, flagged_by, payload',
        },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (action_taken !== undefined) updateData.action_taken = action_taken;
    if (flagged_by !== undefined) updateData.flagged_by = flagged_by;
    if (payload !== undefined) updateData.payload = payload;

    // Update the moderation signal
    const { data, error } = await supabase
      .from('moderation_signals')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Moderation signal not found' }, { status: 404 });
      }
      return NextResponse.json(
        { error: 'Failed to update moderation signal', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
