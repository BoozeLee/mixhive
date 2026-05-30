import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

function adminClient(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service-role env vars not set');
    _admin = createClient(url, key, { auth: { persistSession: false } });
  }
  return _admin;
}

export const dbTools = {
  'db.read': async (table: string, filters: Record<string, unknown> = {}, limit = 20) => {
    let q = adminClient().from(table).select('*').limit(limit);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`db.read ${table}: ${error.message}`);
    return data ?? [];
  },

  'db.read_one': async (table: string, filters: Record<string, unknown>) => {
    let q = adminClient().from(table).select('*').limit(1);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { data, error } = await q;
    if (error) throw new Error(`db.read_one ${table}: ${error.message}`);
    return data?.[0] ?? null;
  },

  'db.insert': async (table: string, row: Record<string, unknown>) => {
    const { data, error } = await adminClient().from(table).insert(row).select().single();
    if (error) throw new Error(`db.insert ${table}: ${error.message}`);
    return data;
  },

  'db.upsert': async (table: string, row: Record<string, unknown>) => {
    const { error } = await adminClient().from(table).upsert(row);
    if (error) throw new Error(`db.upsert ${table}: ${error.message}`);
    return true;
  },

  'db.update': async (
    table: string,
    filters: Record<string, unknown>,
    updates: Record<string, unknown>
  ) => {
    let q = adminClient().from(table).update(updates);
    for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
    const { error } = await q;
    if (error) throw new Error(`db.update ${table}: ${error.message}`);
    return true;
  },

  'db.rpc': async (fn: string, params: Record<string, unknown> = {}) => {
    const ALLOWLISTED_RPCS = new Set(['find_candidate_venues', 'match_ai_embeddings']);
    if (!ALLOWLISTED_RPCS.has(fn)) {
      throw new Error(`db.rpc: "${fn}" is not in the allowed RPC list`);
    }
    const { data, error } = await adminClient().rpc(fn, params);
    if (error) throw new Error(`db.rpc ${fn}: ${error.message}`);
    return data ?? [];
  },
};
