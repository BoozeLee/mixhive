// Admin-only finance export: streams the full payout ledger as CSV for accounting.
import { NextRequest, NextResponse } from 'next/server';
import { makeUserClient, makeServiceClient } from '@/lib/stripe-connect';
import { handleApiError, forbidden } from '@/lib/api-errors';

export const runtime = 'nodejs';

const COLUMNS = [
  'created_at',
  'source_type',
  'source_id',
  'seller_profile_id',
  'gross_amount',
  'platform_fee',
  'net_to_seller',
  'currency',
  'status',
  'stripe_transfer_id',
] as const;

function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const sb = makeUserClient(authHeader.slice(7));
    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { data: profile } = await sb.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile?.is_admin) return forbidden('Admin access required');

    const svc = makeServiceClient();
    const { data: rows, error } = await svc
      .from('platform_fee_ledger')
      .select(COLUMNS.join(','))
      .order('created_at', { ascending: false })
      .limit(10_000);
    if (error) throw error;

    const lines = [COLUMNS.join(',')];
    for (const row of (rows ?? []) as unknown as Record<string, unknown>[]) {
      lines.push(COLUMNS.map((c) => csvCell(row[c])).join(','));
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="mixhive-payouts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handleApiError(err, 'finance/export');
  }
}
