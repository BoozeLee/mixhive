#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
turn_dir="${repo_root}/infra/turn"
tf_dir="${turn_dir}/terraform"
ansible_dir="${turn_dir}/ansible"
inventory="${ansible_dir}/inventory.generated.yml"

: "${HCLOUD_TOKEN:?Export HCLOUD_TOKEN before provisioning}"
command -v terraform >/dev/null
command -v ansible-playbook >/dev/null
command -v curl >/dev/null
command -v jq >/dev/null

wait_for_ssh() {
  local target="$1"
  for _ in {1..60}; do
    if ssh -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "$target" true 2>/dev/null; then
      return 0
    fi
    sleep 5
  done
  printf 'Timed out waiting for SSH on %s. Inspect the Hetzner console before retrying.\n' "$target" >&2
  return 1
}

terraform -chdir="$tf_dir" init
terraform -chdir="$tf_dir" apply

server_id="$(terraform -chdir="$tf_dir" output -raw server_id)"
server_ip="$(terraform -chdir="$tf_dir" output -raw server_ipv4)"
ssh_key_id="$(terraform -chdir="$tf_dir" output -raw ssh_key_id)"

cat >"$inventory" <<EOF
all:
  children:
    rescue:
      hosts:
        mixhive-turn-rescue:
          ansible_host: ${server_ip}
          ansible_user: root
    turn:
      hosts:
        mixhive-turn-01:
          ansible_host: ${server_ip}
          ansible_user: root
EOF

printf 'Enabling Hetzner Rescue on server %s...\n' "$server_id"
curl -fsS -X POST \
  -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"linux64\",\"ssh_keys\":[${ssh_key_id}]}" \
  "https://api.hetzner.cloud/v1/servers/${server_id}/actions/enable_rescue" >/dev/null

curl -fsS -X POST \
  -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
  "https://api.hetzner.cloud/v1/servers/${server_id}/actions/reset" >/dev/null

known_hosts="${HOME}/.ssh/known_hosts"
ssh-keygen -R "$server_ip" -f "$known_hosts" >/dev/null 2>&1 || true
wait_for_ssh "root@${server_ip}"

ANSIBLE_CONFIG="${ansible_dir}/ansible.cfg" \
  ansible-playbook "${ansible_dir}/install-arch.yml" \
  --inventory "$inventory"

curl -fsS -X POST \
  -H "Authorization: Bearer ${HCLOUD_TOKEN}" \
  "https://api.hetzner.cloud/v1/servers/${server_id}/actions/reset" >/dev/null

ssh-keygen -R "$server_ip" -f "$known_hosts" >/dev/null 2>&1 || true
wait_for_ssh "root@${server_ip}"

ANSIBLE_CONFIG="${ansible_dir}/ansible.cfg" \
  ansible-playbook "${ansible_dir}/configure-host.yml" \
  --inventory "$inventory"

cat >"$inventory" <<EOF
all:
  children:
    turn:
      hosts:
        mixhive-turn-01:
          ansible_host: ${server_ip}
          ansible_user: turnadmin
EOF
wait_for_ssh "turnadmin@${server_ip}"

cat <<EOF
Arch bootstrap completed.

Create this DNS-only/unproxied record before continuing:
  turn.mixhive.app A ${server_ip} TTL 300

Then run:
  ${turn_dir}/activate-turn.sh
EOF
