import { NextRequest, NextResponse } from 'next/server';
import { enqueue_audio_job } from '@/lib/database-queries';

export async function POST(req: NextRequest) {
  try {
    // Create Supabase client with service role for internal operations
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get authentication context (internal service calls don't need user auth)
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const serviceToken = authHeader.substring(7);
    
    // Verify service token (in production, this would be validated against a secure secret)
    if (serviceToken !== process.env.SERVICE_ROLE_TOKEN) {
      return NextResponse.json(
        { error: 'Invalid service token' },
        { status: 401 }
      );
    }

    const { mixId, jobType = 'waveform', maxRetries = 3 } = await req.json();

    // Validate required parameters
    if (!mixId) {
      return NextResponse.json(
        { error: 'mixId is required' },
        { status: 400 }
      );
    }

    if (!jobType || !['waveform', 'metadata', 'bpm_key_mood', 'tracklist'].includes(jobType)) {
      return NextResponse.json(
        { error: 'Invalid jobType. Must be one of: waveform, metadata, bpm_key_mood, tracklist' },
        { status: 400 }
      );
    }

    // Validate that the mix exists and is in the correct state
    const { data: mix, error: mixError } = await supabase
      .from('mixes')
      .select('id, upload_status, file_url')
      .eq('id', mixId)
      .single();

    if (mixError || !mix) {
      return NextResponse.json(
        { error: 'Mix not found' },
        { status: 404 }
      );
    }

    // Check if mix is ready for processing
    if (mix.upload_status === 'failed') {
      return NextResponse.json(
        { error: 'Mix processing failed, cannot enqueue new jobs' },
        { status: 400 }
      );
    }

    // Check if mix is already ready
    if (mix.upload_status === 'ready') {
      return NextResponse.json({
        jobId: null,
        message: 'Mix is already processed and ready',
        status: 'already_complete'
      });
    }

    // Update mix status to processing if it's still uploaded
    if (mix.upload_status === 'uploaded') {
      const { error: updateError } = await supabase
        .from('mixes')
        .update({ 
          upload_status: 'processing',
          processing_started_at: new Date().toISOString()
        })
        .eq('id', mixId);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to update mix status', details: updateError.message },
          { status: 500 }
        );
      }
    }

    // Enqueue the audio processing job
    let jobId;
    try {
      // Call the database function to enqueue the job
      const { data: jobData, error: jobError } = await supabase
        .rpc('enqueue_audio_job', {
          p_mix_id: mixId,
          p_job_type: jobType,
          p_max_retries: maxRetries
        });

      if (jobError) {
        throw jobError;
      }

      jobId = jobData;
    } catch (dbError) {
      // If RPC fails, try direct insertion
      const { data: jobData, error: insertError } = await supabase
        .from('audio_jobs')
        .insert({
          mix_id: mixId,
          job_type: jobType,
          max_retries: maxRetries,
          status: 'pending'
        })
        .select('id')
        .single();

      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to enqueue audio job', details: insertError.message },
          { status: 500 }
        );
      }

      jobId = jobData.id;
    }

    return NextResponse.json({
      jobId,
      status: 'queued',
      message: 'Audio processing job enqueued successfully'
    });

  } catch (error) {
    console.error('Audio processing job enqueue error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

