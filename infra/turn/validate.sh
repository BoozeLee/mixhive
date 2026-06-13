#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
turn_dir="${repo_root}/infra/turn"
tf_dir="${turn_dir}/terraform"
ansible_dir="${turn_dir}/ansible"
inventory="${ansible_dir}/inventory.example.yml"

terraform fmt -check -recursive "$tf_dir"
terraform -chdir="$tf_dir" init -backend=false
terraform -chdir="$tf_dir" validate

for playbook in install-arch.yml configure-host.yml configure-turn.yml; do
  ANSIBLE_CONFIG="${ansible_dir}/ansible.cfg" \
    ansible-playbook --syntax-check --inventory "$inventory" "${ansible_dir}/${playbook}"
done

bash -n \
  "${turn_dir}/bootstrap.sh" \
  "${turn_dir}/activate-turn.sh" \
  "${turn_dir}/configure-vercel.sh"
printf 'TURN infrastructure validation passed.\n'
