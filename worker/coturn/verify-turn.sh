#!/usr/bin/env bash
set -euo pipefail

host="${TURN_HOST:-turn.mixhive.app}"
secret="${TURN_SHARED_SECRET:?TURN_SHARED_SECRET is required}"
ttl="${TURN_CREDENTIAL_TTL_SECONDS:-21600}"
username="$(( $(date +%s) + ttl )):turn-healthcheck"
credential="$(printf '%s' "$username" | openssl dgst -binary -sha1 -hmac "$secret" | openssl base64 -A)"

turnutils_uclient -u "$username" -w "$credential" -p 3478 "$host"
turnutils_uclient -t -u "$username" -w "$credential" -p 3478 "$host"
turnutils_uclient -S -t -u "$username" -w "$credential" -p 5349 "$host"
