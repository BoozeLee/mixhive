import { NextRequest, NextResponse } from 'next/server';
import { fetchOembed } from '@/lib/oembed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });
  const data = await fetchOembed(url);
  if (!data) return NextResponse.json({ error: 'unsupported provider' }, { status: 422 });
  return NextResponse.json(data);
}
