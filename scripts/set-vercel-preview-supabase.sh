#!/usr/bin/env bash
set -e

echo "🚀 Setting Supabase environment variables for Vercel Preview environment"
echo "Project: mixhive"
echo ""

cd "$(dirname "$0")/.."

# Values retrieved via `supabase projects api-keys`
SUPABASE_URL="https://wlfjbzdzmrqiiguyoulj.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZmpiemR6bXJxaWlndXlvdWxqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTg3NzIsImV4cCI6MjA5NTAzNDc3Mn0.HcsJo1Y7FemYsputRsEtCB9HJifeNUvvfPNCpWcyqAw"
SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsZmpiemR6bXJxaWlndXlvdWxqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ1ODc3MiwiZXhwIjoyMDk1MDM0NzcyfQ.miESu8_JVfXFbdoZNmZc9aOqmq1pUp1yInb3TAP_5L8"

echo "Adding NEXT_PUBLIC_SUPABASE_URL to Preview..."
printf "%s\n\n" "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL preview

echo ""
echo "Adding NEXT_PUBLIC_SUPABASE_ANON_KEY to Preview..."
printf "%s\n\n" "$ANON_KEY" | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview

echo ""
echo "Adding SUPABASE_SERVICE_ROLE_KEY to Preview..."
printf "%s\n\n" "$SERVICE_ROLE_KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY preview

echo ""
echo "✅ Environment variables set for Preview!"
echo ""
echo "Next: Deploy a new Preview to pick up the changes:"
echo "   vercel"
echo ""
echo "Or deploy to production:"
echo "   vercel --prod"
echo ""
echo "Tip: If the CLI asks about Git branch during 'env add', just press Enter (empty = all Preview branches)."
