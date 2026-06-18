#!/usr/bin/env bash
set -e

echo "=============================================="
echo "  MixHive Google OAuth Setup (CLI Assisted)"
echo "=============================================="
echo ""

echo "Current Google Cloud Project:"
gcloud config get-value project

echo ""
echo "Current Supabase Project (linked):"
cd /home/kilisan/dj-nef-website/mixhive
supabase projects list 2>/dev/null | grep "●"

echo ""
echo "=== Required Authorized Redirect URIs ==="
echo "You must add ALL of these in Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client ID:"
echo ""

cat << EOF
https://mixhive.app/auth/callback
https://www.mixhive.app/auth/callback
https://mixhive-*.vercel.app/auth/callback
https://mixhive.app/api/auth/callback
https://ljdolmqytncxhgojqguh.supabase.co/auth/v1/callback
EOF

echo ""
echo "=== How to add them using gcloud (limited support) ==="
echo "Unfortunately, gcloud does not have a simple one-liner to update OAuth client redirect URIs."
echo "You will likely need to do this in the Google Cloud Console:"
echo "https://console.cloud.google.com/apis/credentials?project=mixhive-platform"
echo ""

echo "=== Current Google secrets in Supabase ==="
supabase secrets list 2>/dev/null | grep -E "GOOGLE|CLIENT" || echo "Could not list (run from project dir)"

echo ""
echo "If you have the real GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from Google Cloud,"
echo "you can set them with:"
echo ""
echo "  supabase secrets set GOOGLE_CLIENT_ID=YOUR_CLIENT_ID"
echo "  supabase secrets set GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET"
echo ""
echo "Then redeploy:"
echo "  vercel --prod"
