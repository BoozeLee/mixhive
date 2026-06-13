#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
turn_dir="${repo_root}/infra/turn"
tf_dir="${turn_dir}/terraform"
ansible_dir="${turn_dir}/ansible"
inventory="${ansible_dir}/inventory.generated.yml"

test -f "$inventory"
server_ip="$(terraform -chdir="$tf_dir" output -raw server_ipv4)"

resolved="$(getent ahostsv4 turn.mixhive.app | awk '{print $1}' | sort -u)"
if ! grep -Fxq "$server_ip" <<<"$resolved"; then
  printf 'DNS checkpoint not satisfied.\nExpected: turn.mixhive.app A %s\nResolved: %s\n' "$server_ip" "${resolved:-<nothing>}" >&2
  exit 1
fi

ANSIBLE_CONFIG="${ansible_dir}/ansible.cfg" \
  ansible-playbook "${ansible_dir}/configure-turn.yml" \
  --inventory "$inventory"

cat <<EOF
TURN relay is active and transport checks passed.

Configure the fail-closed production variables without writing the shared secret to disk:
  ${turn_dir}/configure-vercel.sh

Enable TURN_CREDENTIALS_ENABLED only after the authenticated two-creator
separate-network relay test passes.
EOF
