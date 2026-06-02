import { NextResponse } from 'next/server';

export async function GET() {
  const start = performance.now();
  const result: {
    status: string;
    latency: number;
    bucketCount: number;
    buckets: string[];
    error: string | null;
  } = {
    status: 'healthy',
    latency: 0,
    bucketCount: 0,
    buckets: [],
    error: null,
  };

  try {
    const hasNextPublicSupabasePair = Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    const supabaseUrl = hasNextPublicSupabasePair
      ? process.env.NEXT_PUBLIC_SUPABASE_URL
      : process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = hasNextPublicSupabasePair
      ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      : process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      result.status = 'unhealthy';
      result.error = 'Supabase URL or anon key not configured';
      result.latency = Math.round(performance.now() - start);
      return NextResponse.json(result, { status: 200 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    const { data: buckets, error } = await supabase.storage.listBuckets();

    result.latency = Math.round(performance.now() - start);

    if (error) {
      result.status = 'unhealthy';
      result.error = error.message;
    } else {
      result.bucketCount = buckets?.length ?? 0;
      result.buckets = (buckets ?? []).map((b) => b.name);
    }
  } catch (error) {
    result.status = 'unhealthy';
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.latency = Math.round(performance.now() - start);
  }

  return NextResponse.json(result, { status: 200 });
}
