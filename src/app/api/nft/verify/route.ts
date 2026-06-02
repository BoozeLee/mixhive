import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError, unauthorized } from '@/lib/api-errors';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collection_id');

    if (!collectionId) {
      return NextResponse.json({ error: 'collection_id is required' }, { status: 400 });
    }

    const { count } = await supabase
      .from('nft_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('collection_id', collectionId)
      .eq('holder_profile', user.id);

    return NextResponse.json({ holds_token: (count ?? 0) > 0 });
  } catch (error) {
    return handleApiError(error, 'nft:verify');
  }
}
