#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Setting Supabase env vars on Vercel using REST API (fully non-interactive)"

cd "$(dirname "$0")/.."

# === CONFIG ===
VERCEL_TOKEN=$(cat /home/kilisan/.local/share/com.vercel.cli/auth.json | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
PROJECT_ID="prj_0zvWDkQJxUqA6duo936KG9afO26j"   # mixhive project

# Values from `supabase projects api-keys`
SUPABASE_URL="https://wlfjbzdzmrqiiguyoulj.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZmpiemR6bXJxaWlndXlvdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTg3NzIsImV4cCI6MjA5NTAzNDc3Mn0.HcsJo1Y7FemYsputRsEtCB9HJifeNUvvfPNCpWcyqAw"
SERVICE_ROLE="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZmpiemR6bXJxaWlndXlvdWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ1ODc3MiwiZXhwIjoyMDk1MDM0NzcyfQ.miESu8_JVfXFbdoZNmZc9aOqmq1pUp1yInb3TAP_5L8"

# === FUNCTIONS ===
upsert_env() {
  local key="$1"
  local value="$2"
  local targets='["preview","production"]'

  echo "→ Upserting $key for preview + production ..."

  # First try to update if exists
  curl -s -X PATCH \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.vercel.com/v9/projects/$PROJECT_ID/env" \
    -d '{
      "key": "'"$key"'",
      "value": "'"$value"'",
      "type": "encrypted",
      "target": '"$targets"'
    }' | python3 -c '
import sys, json
data = json.load(sys.stdin)
if "error" in data:
    print("  Update failed (probably does not exist yet):", data.get("error", {}).get("message", ""))
else:
    print("  Updated successfully")
' || true

  # If update failed, create new
  curl -s -X POST \
    -H "Authorization: Bearer $VERCEL_TOKEN" \
    -H "Content-Type: application/json" \
    "https://api.vercel.com/v9/projects/$PROJECT_ID/env" \
    -d '{
      "key": "'"$key"'",
      "value": "'"$value"'",
      "type": "encrypted",
      "target": '"$targets"'
    }' | python3 -c '
import sys, json
data = json.load(sys.stdin)
if "error" in data:
    print("  Create failed:", data.get("error", {}).get("message", ""))
elif data.get("created"):
    print("  Created successfully")
else:
    print("  Response:", json.dumps(data)[:200])
' 
}

# === EXECUTE ===
echo "Project ID: $PROJECT_ID"
echo ""

upsert_env "NEXT_PUBLIC_SUPABASE_URL" "$SUPABASE_URL"
upsert_env "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$ANON_KEY"
upsert_env "SUPABASE_SERVICE_ROLE_KEY" "$SERVICE_ROLE"

echo ""
echo "✅ All Supabase variables have been set for Preview + Production via API."
echo ""
echo "Trigger a new deployment to pick them up:"
echo "   vercel --prod"
echo ""
echo "Or just push to GitHub to get a fresh preview build."