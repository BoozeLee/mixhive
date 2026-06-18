#!/usr/bin/env bash
# Apply the AI-Band migrations (103, 104) to a Supabase project via the
# Management API over HTTPS. Use this when the Postgres port (5432/6543) is
# firewalled so `supabase db push` can't open a DB socket (the case on this box).
#
# Run it in YOUR shell so the token stays out of any agent transcript:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx bash scripts/apply_ai_band_migrations.sh
#
# Token: mint at https://supabase.com/dashboard/account/tokens
# Project ref defaults to BeeHiveStudio; override with SUPABASE_PROJECT_REF.
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-ljdolmqytncxhgojqguh}"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN (https://supabase.com/dashboard/account/tokens)}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/supabase/migrations"
URL="https://api.supabase.com/v1/projects/$REF/database/query"

api() {
  curl -fsS -X POST "$URL" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" --data @-
}
run_sql() { printf '%s' "$1" | jq -Rs '{query: .}' | api; echo; }

for m in 103_ai_agent_provenance 104_ai_agents; do
  echo ">> applying $m.sql"
  jq -Rs '{query: .}' "$DIR/$m.sql" | api
  echo
done

echo ">> recording migration history"
run_sql "insert into supabase_migrations.schema_migrations(version,name) values ('103','ai_agent_provenance'),('104','ai_agents') on conflict do nothing;"

echo ">> verifying schema"
run_sql "select to_regclass('public.ai_agents') is not null as ai_agents,
                to_regclass('public.mix_agent_credits') is not null as mix_agent_credits,
                exists(select 1 from information_schema.columns
                       where table_schema='public' and table_name='mixes' and column_name='ai_band') as mixes_ai_band;"

echo ">> done"
