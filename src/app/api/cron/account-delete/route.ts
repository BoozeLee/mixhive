import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Daily cron at 03:00 UTC — finalizes account-deletion requests whose 30-day
// grace window has expired. Protected by CRON_SECRET.
//
// Strategy:
//   1. Users WITHOUT financial/legal retention obligations are hard-deleted via
//      auth.admin.deleteUser(), which cascades to public.profiles and most
//      related rows.
//   2. Users WITH equipment marketplace transactions or active paid subscriptions
//      are anonymized in place: PII is blanked in profiles and auth.users, but
//      the user id is retained for transaction/accounting integrity.
//   3. Storage objects owned by the user are removed in both cases (best-effort).

const GRACE_DAYS = 30;

// Buckets known to contain user-owned objects. For each, we list objects under
// the user-id prefix and remove them. Best-effort: individual failures are logged
// but do not block the deletion.
const USER_OWNED_BUCKETS = [
  'avatars',
  'banners',
  'mixes',
  'artwork',
  'buzz-media',
  'mix-audio',
  'mix-waveforms',
  'mixes-original',
  'profile-avatars',
  'user-uploads',
];

type DeletionResult = {
  userId: string;
  action: 'deleted' | 'anonymized';
  storageObjectsRemoved: number;
  error?: string;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sb = createServerClient();
    const cutoff = new Date(Date.now() - GRACE_DAYS * 86_400_000).toISOString();

    const { data: requests, error: fetchErr } = await sb
      .from('deletion_requests')
      .select('id, user_id')
      .eq('status', 'requested')
      .lte('process_after', cutoff);

    if (fetchErr) throw fetchErr;
    if (!requests || requests.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    const results: DeletionResult[] = [];
    const errors: { userId: string; error: string }[] = [];

    for (const req of requests) {
      try {
        const result = await finalizeUser(sb, req.user_id);
        results.push(result);

        await markDone(sb, req.id);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as { message: unknown }).message)
              : 'Unknown error';
        console.error(`[account-delete] failed for ${req.user_id}:`, err);
        errors.push({ userId: req.user_id, error: message });

        // Best-effort increment of error_count; column is added by migration 106.
        // A failed request keeps status 'requested' and is retried on the next
        // nightly run, so this must accumulate — a row stuck at 1 would hide
        // exactly the repeatedly-failing requests the column exists to surface.
        // Read-then-write is safe here: the cron is a single daily runner.
        const { data: current } = await sb
          .from('deletion_requests')
          .select('error_count')
          .eq('id', req.id)
          .maybeSingle();

        const { error: countErr } = await sb
          .from('deletion_requests')
          .update({ error_count: (current?.error_count ?? 0) + 1 })
          .eq('id', req.id);
        if (countErr) {
          console.error(
            `[account-delete] failed to increment error_count for ${req.user_id}:`,
            countErr
          );
        }
      }
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      deleted: results.filter(r => r.action === 'deleted').length,
      anonymized: results.filter(r => r.action === 'anonymized').length,
      storage_objects_removed: results.reduce((sum, r) => sum + r.storageObjectsRemoved, 0),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

async function finalizeUser(
  sb: ReturnType<typeof createServerClient>,
  userId: string
): Promise<DeletionResult> {
  const mustRetain = await hasRetentionRecords(sb, userId);

  // Always attempt storage cleanup first so even anonymized users don't keep
  // personal media on disk.
  const storageObjectsRemoved = await cleanupUserStorage(sb, userId);

  if (mustRetain) {
    await anonymizeUser(sb, userId);
    return { userId, action: 'anonymized', storageObjectsRemoved };
  }

  await hardDeleteUser(sb, userId);
  return { userId, action: 'deleted', storageObjectsRemoved };
}

async function hasRetentionRecords(
  sb: ReturnType<typeof createServerClient>,
  userId: string
): Promise<boolean> {
  // Equipment marketplace transactions must be retained for legal/accounting.
  const { count: txnCount, error: txnErr } = await sb
    .from('equipment_transactions')
    .select('*', { count: 'exact', head: true })
    .or(`buyer_profile_id.eq.${userId},seller_profile_id.eq.${userId}`);

  if (txnErr) {
    console.error(`[account-delete] retention check error for ${userId}:`, txnErr);
  }
  if ((txnCount ?? 0) > 0) return true;

  // Active paid subscriptions (migration 102) also require retention — the
  // user's identity must remain for financial/audit records tied to payments.
  const { data: sub, error: subErr } = await sb
    .from('user_subscriptions')
    .select('tier, status')
    .eq('user_id', userId)
    .maybeSingle();

  if (subErr) {
    console.error(`[account-delete] subscription retention error for ${userId}:`, subErr);
  }
  if (sub && sub.tier !== 'free' && sub.status !== 'canceled') {
    return true;
  }

  return false;
}

async function hardDeleteUser(
  sb: ReturnType<typeof createServerClient>,
  userId: string
): Promise<void> {
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) throw error;
}

async function markDone(
  sb: ReturnType<typeof createServerClient>,
  requestId: string
): Promise<void> {
  // Try the post-migration 106 schema first.
  const { error: withTimestampErr } = await sb
    .from('deletion_requests')
    .update({ status: 'done', finalized_at: new Date().toISOString() })
    .eq('id', requestId);

  if (!withTimestampErr) return;

  // Fallback for pre-migration 106 schema where finalized_at does not exist.
  const { error: withoutTimestampErr } = await sb
    .from('deletion_requests')
    .update({ status: 'done' })
    .eq('id', requestId);

  if (withoutTimestampErr) throw withoutTimestampErr;
}

async function anonymizeUser(
  sb: ReturnType<typeof createServerClient>,
  userId: string
): Promise<void> {
  const now = new Date().toISOString();

  // Blank all PII in the public profile. Username must stay unique, non-null,
  // and conform to profiles_username_format (^[A-Za-z0-9_]{3,30}$).
  const shortHash = userId.replace(/-/g, '').slice(0, 22);
  const anonUsername = `deleted_${shortHash}`;

  const { error: profileErr } = await sb
    .from('profiles')
    .update({
      username: anonUsername,
      display_name: 'Deleted User',
      bio: null,
      avatar_url: null,
      banner_url: null,
      location: null,
      website: null,
      genres: [],
      social_links: {},
      dj_style: null,
      dj_equipment: [],
      dj_daw: [],
      updated_at: now,
    })
    .eq('id', userId);

  if (profileErr) throw profileErr;

  // Anonymize the auth record. We keep the id as a stable foreign key for
  // retained financial rows.
  const { error: authErr } = await sb.auth.admin.updateUserById(userId, {
    email: `deleted+${userId}@mixhive.app`,
    phone: null,
    user_metadata: {},
    app_metadata: {},
  });

  if (authErr) throw authErr;

  // Delete rows that don't add retention value but do contain personal data.
  // Best-effort: ignore individual failures.
  const bestEffortTables: { table: string; column: string }[] = [
    { table: 'user_consents', column: 'user_id' },
    { table: 'user_ai_keys', column: 'user_id' },
    { table: 'push_subscriptions', column: 'user_id' },
    { table: 'siwe_nonces', column: 'user_id' },
    { table: 'artist_goals', column: 'user_id' },
    { table: 'notification_settings', column: 'user_id' },
  ];

  for (const { table, column } of bestEffortTables) {
    try {
      await sb.from(table).delete().eq(column, userId);
    } catch (err) {
      console.error(`[account-delete] best-effort delete failed ${table}.${column}:`, err);
    }
  }
}

async function cleanupUserStorage(
  sb: ReturnType<typeof createServerClient>,
  userId: string
): Promise<number> {
  let removed = 0;

  for (const bucket of USER_OWNED_BUCKETS) {
    try {
      const paths = await listStoragePaths(sb, bucket, userId);
      if (paths.length === 0) continue;

      // Remove in batches of 100 (Supabase limit).
      for (let i = 0; i < paths.length; i += 100) {
        const batch = paths.slice(i, i + 100);
        const { error } = await sb.storage.from(bucket).remove(batch);
        if (error) {
          console.error(`[account-delete] storage remove failed ${bucket}:`, error);
        } else {
          removed += batch.length;
        }
      }
    } catch (err) {
      console.error(`[account-delete] storage cleanup error ${bucket} for ${userId}:`, err);
    }
  }

  return removed;
}

async function listStoragePaths(
  sb: ReturnType<typeof createServerClient>,
  bucket: string,
  prefix: string
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  const pageSize = 100;

  while (true) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: pageSize, offset });

    if (error) {
      if (error.message?.includes('Bucket not found')) return [];
      throw error;
    }

    const items = data ?? [];
    const files = items.filter(item => item.id !== null);
    const folders = items.filter(item => item.id === null);

    paths.push(...files.map(item => `${prefix}/${item.name}`));

    // Recurse into sub-folders.
    for (const folder of folders) {
      const nested = await listStoragePaths(sb, bucket, `${prefix}/${folder.name}`);
      paths.push(...nested);
    }

    if (items.length < pageSize) break;
    offset += pageSize;
  }

  return paths;
}
