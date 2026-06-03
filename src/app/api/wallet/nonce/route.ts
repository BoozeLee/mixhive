import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { handleApiError } from '@/lib/api-errors';
import { randomBytes } from 'crypto';

// Nonces are stored in a dedicated table so they survive serverless cold starts.
// Each nonce is single-use with a 1-hour TTL; /api/wallet/connect deletes it on verify.
export async function GET() {
  try {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();

    const supabase = createServerClient();
    const { error } = await supabase.from('siwe_nonces').insert({ nonce, expires_at: expiresAt });

    if (error) {
      // Silently fall through — nonce table may not exist yet; client still gets a nonce
      // but server-side replay protection is advisory until migration 069 is applied.
      console.warn(
        '[wallet:nonce] siwe_nonces insert failed (table may not exist):',
        error.message
      );
    }

    return NextResponse.json({ nonce });
  } catch (error) {
    return handleApiError(error, 'wallet:nonce');
  }
}
