import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, unauthorized } from '@/lib/api-errors';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { data: collection, error } = await supabase
      .from('nft_collections')
      .select('*, token_count:nft_tokens(count)')
      .eq('id', id)
      .single();

    if (error || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    return NextResponse.json(collection);
  } catch (error) {
    return handleApiError(error, 'nft:collections:get');
  }
}
