# MixHive Creator Talkback TURN Relay

This runbook provisions a provider-neutral public Coturn VPS for Mythic Ritual creator
talkback. Public audience audio never uses this relay. MixHive issues authenticated
creators six-hour TURN REST credentials; the HMAC signing secret stays server-side.
The supplied relay configuration denies private/link-local peer ranges and limits each
creator credential to 12 concurrent allocations.

## Required infrastructure

- Stable public IPv4 and provider firewall.
- DNS `A` record: `turn.mixhive.app` directly to the VPS. Do not proxy it.
- Stable Linux with systemd, Podman/Quadlet, OpenSSL, Certbot, UFW, and Coturn utilities.
- Minimum initial size: 1 vCPU, 1 GB RAM. Monitor transfer before increasing the
  six-person creator-stage limit.

## VPS bootstrap

Install packages using the VPS distribution's supported package manager. Then:

```bash
git clone https://github.com/BoozeLee/mixhive.git
cd mixhive
sudo install -d -m 0700 /etc/mixhive
openssl rand -base64 48 | tr -d '\n'
sudo install -m 0600 worker/coturn/.env.example /etc/mixhive/coturn.env
sudoedit /etc/mixhive/coturn.env
```

Set the generated value as `TURN_SHARED_SECRET`, the VPS IPv4 as `TURN_EXTERNAL_IP`,
and keep `TURN_REALM=mixhive.app`. The renderer refuses the example secret and secrets
shorter than 32 characters.

Open only the relay and certificate-renewal ports:

```bash
sudo ufw default deny incoming
sudo ufw allow from YOUR_ADMIN_IP to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 49160:49200/udp
sudo ufw enable
```

Obtain the certificate after DNS resolves:

```bash
sudo certbot certonly --standalone -d turn.mixhive.app
sudo ./worker/coturn/install-vps.sh
sudo systemctl status mixhive-coturn.service
```

Add a Certbot deploy hook that restarts the relay after renewal:

```bash
sudo install -d /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/bin/sh' 'systemctl restart mixhive-coturn.service' \
  | sudo tee /etc/letsencrypt/renewal-hooks/deploy/restart-mixhive-coturn >/dev/null
sudo chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/restart-mixhive-coturn
sudo certbot renew --dry-run
```

## Vercel production configuration

Set these server-side production variables. Never create `NEXT_PUBLIC_TURN_*` variables.

```text
TURN_CREDENTIALS_ENABLED=true
TURN_SHARED_SECRET=<same secret as /etc/mixhive/coturn.env>
TURN_URLS=turn:turn.mixhive.app:3478?transport=udp,turn:turn.mixhive.app:3478?transport=tcp,turns:turn.mixhive.app:5349?transport=tcp
TURN_CREDENTIAL_TTL_SECONDS=21600
```

Deploy MixHive after updating Vercel. The credential endpoint deliberately returns `503`
until all required values exist and the kill switch is enabled.

## Verification

Install `turnutils_uclient` from the VPS distribution's Coturn package, load the secret,
and run:

```bash
set -a
source /etc/mixhive/coturn.env
set +a
sudo -E ./worker/coturn/verify-turn.sh
```

This verifies UDP `3478`, TCP `3478`, and TLS `5349`. Then run a two-creator browser
test from separate networks and confirm a `relay` ICE candidate in browser WebRTC
internals. An audience account must never receive credentials or creator audio.

Monitor:

```bash
systemctl status mixhive-coturn.service
journalctl -u mixhive-coturn.service --since today
certbot certificates
```

## Quarterly signing-secret rotation

Rotation causes active creator talkback connections to reconnect once. Synchronized
public previews remain available.

1. Announce a short talkback maintenance window.
2. Set Vercel `TURN_CREDENTIALS_ENABLED=false` and deploy.
3. On the VPS run `sudo ./worker/coturn/rotate-secret.sh`.
4. Copy the printed secret into Vercel `TURN_SHARED_SECRET` and deploy.
5. Run `verify-turn.sh`.
6. Set `TURN_CREDENTIALS_ENABLED=true`, deploy, and run the two-creator browser check.
7. Securely delete `/etc/mixhive/coturn.env.previous`.

For incident response, disable issuance immediately, rotate the secret, and inspect
Coturn logs and VPS bandwidth before re-enabling.
