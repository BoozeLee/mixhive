#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/mixhive/coturn.env}"
new_secret="$(openssl rand -base64 48 | tr -d '\n')"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi

install -m 0600 -o root -g root "$env_file" "${env_file}.previous"
sed -i "s|^TURN_SHARED_SECRET=.*$|TURN_SHARED_SECRET=${new_secret}|" "$env_file"
/usr/local/sbin/mixhive-render-turn-config "$env_file"
systemctl daemon-reload
systemctl restart mixhive-coturn.service

printf 'New TURN_SHARED_SECRET for Vercel:\n%s\n' "$new_secret"
printf 'After Vercel is updated and verified, remove %s.previous\n' "$env_file"
