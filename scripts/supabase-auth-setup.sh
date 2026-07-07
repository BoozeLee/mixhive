#!/usr/bin/env bash
set -e

echo "=============================================="
echo "  MixHive - Supabase Auth Setup Helper"
echo "  (Auto-generated from current codebase + plan)"
echo "=============================================="
echo ""

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "=== 1. REQUIRED SUPABASE AUTH REDIRECT URLs ==="
echo "Add ALL of these in Supabase Dashboard → Authentication → URL Configuration"
echo "(Also update supabase/config.toml [auth] additional_redirect_urls for local/dev parity)"
echo ""

# Robust auto-detect (bash + python via temp file for safety)
echo "# Auto-detected from supabase/config.toml + codebase:"
cat > /tmp/detect_urls.py << 'PYEOF'
import re, os, glob
urls = set()
# Parse config.toml [auth] additional_redirect_urls and site_url
cfg = "supabase/config.toml"
if os.path.exists(cfg):
    with open(cfg) as f:
        content = f.read()
    for m in re.finditer(r'["\']?(https?://[^"\'\s,]+)["\']?', content):
        u = m.group(1).rstrip("/")
        if any(k in u for k in ["mixhive", "localhost", "127.0.0.1", "supabase"]):
            urls.add(u)
            if not any(x in u for x in ["/auth/callback", "/auth/v1/callback", "/auth/reset"]):
                urls.add(u + "/auth/callback")
# Simple grep in src for obvious hardcoded URLs
for path in glob.glob("src/**/*.*", recursive=True):
    if any(path.endswith(ext) for ext in (".ts", ".tsx", ".js", ".json", ".mjs")):
        try:
            with open(path, errors="ignore") as f:
                for line in f:
                    for m in re.finditer(r'https?://[^\s"\'<>()]+', line):
                        u = m.group(0).rstrip(".,;\"')")
                        if any(k in u for k in ["mixhive", "wlfjbz", "supabase.co/auth"]):
                            urls.add(u.rstrip("/"))
        except: pass
for u in sorted(u for u in urls if u):
    print(u)
PYEOF
python3 /tmp/detect_urls.py 2>/dev/null || echo "(auto-detect produced no extra results; using standard list below)"

echo ""
echo "# Comprehensive required set (production + all previews + Supabase callback + localhost):"
cat << 'EOF'
https://mixhive.app
https://mixhive.app/auth/callback
https://mixhive.app/auth/reset-password
https://www.mixhive.app
https://www.mixhive.app/auth/callback
https://www.mixhive.app/auth/reset-password
https://mixhive.vercel.app
https://mixhive.vercel.app/auth/callback
https://mixhive.vercel.app/auth/reset-password
https://mixhive-*.vercel.app
https://mixhive-*.vercel.app/auth/callback
https://mixhive-*.vercel.app/auth/reset-password
https://*.mixhive.vercel.app/auth/callback
https://ljdolmqytncxhgojqguh.supabase.co/auth/v1/callback
http://localhost:3000
http://localhost:3000/auth/callback
http://localhost:3000/auth/reset-password
http://127.0.0.1:3000
http://127.0.0.1:3000/auth/callback
EOF

echo ""
echo "=== 2. EXACT SUPABASE CLI COMMANDS FOR SECRETS ==="
echo "Run these commands (from the mixhive project directory):"
echo ""

GOOGLE_JSON="/home/kilisan/Downloads/client_secret_551280462063-gn57mdi9e0duf4plkpq6ddv8l6do45oc.apps.googleusercontent.com.json"

if [ -f "$GOOGLE_JSON" ]; then
    CLIENT_ID=$(python3 -c "
import sys, json
with open('$GOOGLE_JSON') as f:
    data = json.load(f)
print(data['web']['client_id'])
" 2>/dev/null)
    CLIENT_SECRET=$(python3 -c "
import sys, json
with open('$GOOGLE_JSON') as f:
    data = json.load(f)
print(data['web']['client_secret'])
" 2>/dev/null)

    echo "supabase secrets set GOOGLE_CLIENT_ID=\"$CLIENT_ID\""
    echo "supabase secrets set GOOGLE_CLIENT_SECRET=\"$CLIENT_SECRET\""
else
    echo "# (Google JSON not found at expected path)"
    echo "supabase secrets set GOOGLE_CLIENT_ID=\"YOUR_CLIENT_ID\""
    echo "supabase secrets set GOOGLE_CLIENT_SECRET=\"YOUR_CLIENT_SECRET\""
fi

echo ""
echo "# Other common secrets (if needed):"
echo "# supabase secrets set SENTRY_DSN=\"...\""
echo "# supabase secrets set OPENAI_API_KEY=\"...\""
echo ""

echo "=== 3. VERCEL ENV COMMANDS (Preview + Production) ==="
echo "PREFERRED (non-interactive, targets BOTH preview+production safely):"
echo "  ./scripts/set-vercel-env-api.sh"
echo ""
echo "Alternative: manual vercel CLI (one env at a time):"
echo ""

SUPABASE_URL="https://ljdolmqytncxhgojqguh.supabase.co"

cat << EOF
# Core Supabase (run for 'preview' then repeat for 'production' or use the API script above)
vercel env add NEXT_PUBLIC_SUPABASE_URL preview
# paste: $SUPABASE_URL

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
# paste the anon key (from supabase projects api-keys or dashboard)

vercel env add SUPABASE_SERVICE_ROLE_KEY preview
# paste the service_role key (keep secret!)

# Also set the public site URL (affects useAuth.ts redirects and some links)
vercel env add NEXT_PUBLIC_SITE_URL preview
# recommended: https://mixhive.app   (or the exact Vercel preview URL for testing)

# Repeat the four above, replacing "preview" with "production"
EOF

echo ""
echo "After changing Vercel envs: vercel --prod  (or push to main for auto-deploy)"
echo "Note: Preview deploys do NOT automatically get production-scoped vars; the set-vercel-env-api.sh or PATCH via REST is required for previews."

echo ""
echo "=== 4. USEFUL INSPECTION COMMANDS ==="
echo ""
cat << 'EOF'

# Current secrets (names + digests only)
supabase secrets list

# Migration status (shows which files recorded on remote vs local)
supabase migration list

# === RLS / Policy Deep Inspection (critical for security) ===
# Basic policy summary
supabase db query --linked '
SELECT tablename, policyname, cmd 
FROM pg_policies 
WHERE tablename IN ('\''profiles'\'', '\''mythic_nodes'\'', '\''mythic_edges'\'', '\''mythic_graph_jobs'\'', '\''collab_sessions'\'', '\''collab_session_participants'\'')
ORDER BY tablename, policyname;
'

# Full policy details (qual + with_check)
supabase db query --linked '
SELECT schemaname, tablename, policyname, cmd, 
       CASE WHEN qual IS NOT NULL THEN qual ELSE '\''(no using qual)'\'' END as using_qual
FROM pg_policies 
WHERE tablename IN ('\''mythic_graph_jobs'\'', '\''collab_sessions'\'')
ORDER BY tablename;
'

# Table existence + RLS enabled flag (for new tables)
supabase db query --linked '
SELECT c.relname, c.relrowsecurity as "RLS?", count(p.polname) as policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid=c.oid
WHERE c.relname IN ('\''collab_sessions'\'','\''collab_session_participants'\'','\''mythic_graph_jobs'\'')
  AND n.nspname='\''public'\''
GROUP BY c.relname, c.relrowsecurity ORDER BY c.relname;
'

# Auth / profile creation functions (051 + 049)
supabase db query --linked '
SELECT proname, prosecdef as "SECURITY DEFINER?"
FROM pg_proc 
WHERE proname LIKE '\''%artist_profile%'\'' OR proname LIKE '\''%handle_new_user%'\'' OR proname LIKE '\''%log_performance%'\''
ORDER BY proname;
'

# Pull latest config (review site_url + additional_redirect_urls)
supabase config pull --linked || echo "(config pull may require extra setup; cat supabase/config.toml instead)"
EOF

echo ""
echo "=== 5. SUPABASE CLI AUDIT REPORT (Run the block above, paste results here) ==="
echo "Key findings from live run (2026-05-30):"
echo "  - mythic_graph_jobs: RLS disabled, 0 policies (jobs are mostly enqueued via SECURITY DEFINER RPCs)"
echo "  - collab_* tables: NOT PRESENT on remote DB (050/052 recorded in migration list but CREATEs never succeeded due to prior drift)"
echo "  - 051 trigger function present and working (profile->artist_profile node auto-creation on auth.users)"
echo "  - GOOGLE_* secrets: present"
echo "  - Recommendation: apply 052 (and any 053) only after resolving drift (never force on prod without review)"
echo ""
echo "Script generated: $(date)"
echo "Re-run after any migration, auth config change, or new preview deploy."
