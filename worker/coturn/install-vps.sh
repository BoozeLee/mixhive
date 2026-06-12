#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root on the TURN VPS" >&2
  exit 1
fi

install -d -m 0700 /etc/mixhive
install -m 0755 worker/coturn/render-config.sh /usr/local/sbin/mixhive-render-turn-config
install -m 0755 worker/coturn/verify-turn.sh /usr/local/sbin/mixhive-verify-turn
install -m 0755 worker/coturn/rotate-secret.sh /usr/local/sbin/mixhive-rotate-turn-secret
install -m 0644 worker/coturn/mixhive-coturn.container /etc/containers/systemd/mixhive-coturn.container

if [[ ! -f /etc/mixhive/coturn.env ]]; then
  install -m 0600 worker/coturn/.env.example /etc/mixhive/coturn.env
  echo "Edit /etc/mixhive/coturn.env, obtain TLS certificates, then rerun this installer." >&2
  exit 1
fi

/usr/local/sbin/mixhive-render-turn-config
systemctl daemon-reload
systemctl enable --now mixhive-coturn.service
