import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { renderToStream } from '@react-pdf/renderer';
import { EpkPdfDocument } from '@/components/epk/EpkPdfDocument';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const sb = createServerClient();

    const { data: kit, error } = await sb
      .from('press_kits')
      .select('content, is_public, owner_id, title')
      .eq('public_slug', slug)
      .maybeSingle();

    if (error) throw error;
    if (!kit || !kit.is_public) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const content = kit.content as unknown as Record<string, unknown>;
    const stream = await renderToStream(
      React.createElement(EpkPdfDocument, {
        title: kit.title || `${content.artist_name} EPK`,
        artistName: content.artist_name || 'Artist',
        location: content.location,
        bio: content.bio,
        genres: content.genres || [],
        website: content.website,
        topMixes: content.top_mixes || [],
        bookingPitch: content.booking_pitch || '',
        technicalNotes: content.technical_notes || [],
        avatarUrl: content.avatar_url,
      })
    );

    return new NextResponse(stream as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${slug}.pdf"`,
      },
    });
  } catch (err) {
    console.error('[epk/pdf] error:', err);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
