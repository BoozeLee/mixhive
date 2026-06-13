#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
turn_dir="${repo_root}/infra/turn"
tf_dir="${turn_dir}/terraform"
inventory="${turn_dir}/ansible/inventory.generated.yml"

test -f "$inventory"
command -v ssh >/dev/null
command -v terraform >/dev/null
command -v vercel >/dev/null

server_ip="$(terraform -chdir="$tf_dir" output -raw server_ipv4)"
turn_secret="$(
  ssh "turnadmin@${server_ip}" \
    "sudo awk -F= '\$1 == \"TURN_SHARED_SECRET\" { print \$2 }' /etc/mixhive/coturn.env"
)"

if [[ ${#turn_secret} -lt 32 ]]; then
  printf 'Refusing to configure Vercel: the remote TURN secret is missing or too short.\n' >&2
  exit 1
fi

add_production_env() {
  local name="$1"
  local value="$2"
  printf '%s' "$value" | vercel env add "$name" production --force --yes
}

# Keep credential issuance disabled until a real separate-network relay test passes.
add_production_env TURN_CREDENTIALS_ENABLED false
add_production_env TURN_SHARED_SECRET "$turn_secret"
add_production_env TURN_URLS \
  'turn:turn.mixhive.app:3478?transport=udp,turn:turn.mixhive.app:3478?transport=tcp,turns:turn.mixhive.app:5349?transport=tcp'
add_production_env TURN_CREDENTIAL_TTL_SECONDS 21600
unset turn_secret

cat <<'EOF'
Production TURN variables are configured with credential issuance disabled.

Redeploy MixHive, run the authenticated two-creator separate-network relay test,
then set TURN_CREDENTIALS_ENABLED=true and redeploy again.
EOF
