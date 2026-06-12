#!/usr/bin/env bash
set -euo pipefail

env_file="${1:-/etc/mixhive/coturn.env}"
output="${2:-/etc/mixhive/turnserver.conf}"

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

: "${TURN_SHARED_SECRET:?TURN_SHARED_SECRET is required}"
: "${TURN_EXTERNAL_IP:?TURN_EXTERNAL_IP is required}"
: "${TURN_REALM:=mixhive.app}"

if [[ "$TURN_SHARED_SECRET" == "generate-a-32-byte-or-longer-random-secret" || ${#TURN_SHARED_SECRET} -lt 32 ]]; then
  echo "TURN_SHARED_SECRET must be a non-example secret of at least 32 characters" >&2
  exit 1
fi

umask 077
cat >"$output" <<EOF
no-cli
fingerprint
use-auth-secret
static-auth-secret=${TURN_SHARED_SECRET}
realm=${TURN_REALM}
external-ip=${TURN_EXTERNAL_IP}
cert=/etc/letsencrypt/live/turn.mixhive.app/fullchain.pem
pkey=/etc/letsencrypt/live/turn.mixhive.app/privkey.pem
no-multicast-peers
stale-nonce=600
user-quota=12
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
min-port=49160
max-port=49200
EOF
