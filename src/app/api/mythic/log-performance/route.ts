import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { log_performance, LogPerformanceParams } from '@/lib/database-queries';
import { z } from 'zod';
import { handleApiError, unauthorized } from '@/lib/api-errors';

// Robust Zod schema for runtime validation
const LogPerformanceSchema = z.object({
  date: z.string().datetime({ message: "Invalid ISO date" }),
  venueName: z.string().min(1, "Venue name is required").max(200),
  city: z.string().max(100).optional().nullable(),
  role: z.string().max(50).optional().default("support"),
  notes: z.string().max(2000).optional().nullable(),
  link: z.string().url().optional().nullable().or(z.literal('')),
  promoterName: z.string().max(200).optional().nullable(),
  coBilled: z.array(z.string().max(200)).optional().default([]),
});

/**
 * POST /api/mythic/log-performance
 *
 * Logs a real-world performance (gig) for the authenticated artist.
 * This powers the Tour Weaver (Experiment 5) by creating performed_at + venue nodes/edges.
 *
 * Body: LogPerformanceParams (artistId must match the authenticated user or be authorized)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const parsed = LogPerformanceSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input', 
          issues: parsed.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const body = parsed.data;

    // Security: Force the artistId to be the authenticated user's profile
    // (In a more advanced version we could support team members / agents)
    const artistId = user.id; // This assumes profile id == auth user id. Adjust if your model differs.

    const result = await log_performance({
      artistId,
      date: body.date,
      venueName: body.venueName,
      city: body.city ?? null,
      role: body.role ?? 'support',
      coBilled: body.coBilled ?? [],
      promoterName: body.promoterName ?? null,
      notes: body.notes ?? null,
      link: body.link ?? null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to log performance' },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return handleApiError(error, 'log-performance');
  }
}