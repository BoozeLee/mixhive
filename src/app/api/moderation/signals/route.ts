import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client with service role for internal operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify service token (internal service calls don't need user auth)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const serviceToken = authHeader.substring(7);
    if (serviceToken !== process.env.SERVICE_ROLE_TOKEN) {
      return NextResponse.json({ error: 'Invalid service token' }, { status: 401 });
    }

    const { source_table, source_id, signal_type, severity, action_taken, flagged_by, payload } =
      await req.json();

    // Validate required fields
    if (!source_table || !source_id || !signal_type || !severity) {
      return NextResponse.json(
        { error: 'Missing required fields: source_table, source_id, signal_type, severity' },
        { status: 400 }
      );
    }

    // Validate severity enum
    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    // Insert the moderation signal
    const { data, error } = await supabase
      .from('moderation_signals')
      .insert({
        source_table,
        source_id,
        signal_type,
        severity,
        action_taken: action_taken ?? null,
        flagged_by: flagged_by ?? 'moderation_agent',
        payload: payload ?? {},
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create moderation signal', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
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

// GET handler for fetching moderation signals (with optional filtering)
export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const source_table = searchParams.get('source_table');
    const source_id = searchParams.get('source_id');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status'); // Note: we don't have a status column, but we can use action_taken or create a computed status
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('moderation_signals')
      .select('*')
      .order('created_at', { ascending: false });

    if (source_table) {
      query = query.eq('source_table', source_table);
    }
    if (source_id) {
      query = query.eq('source_id', source_id);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    // Note: We don't have a status column, but we can filter by action_taken if needed
    // For now, we'll ignore the status parameter since the table doesn't have a status column.
    // We can add a status column in a future migration if needed.

    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch moderation signals', details: error.message },
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
