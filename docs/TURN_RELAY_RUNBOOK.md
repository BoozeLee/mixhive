# MixHive Creator Talkback TURN Relay

This runbook provisions a provider-neutral public Coturn VPS for Mythic Ritual creator
talkback. Public audience audio never uses this relay. MixHive issues authenticated
creators six-hour TURN REST credentials; the HMAC signing secret stays server-side.
The supplied relay configuration denies private/link-local peer ranges and limits each
creator credential to 12 concurrent allocations.

## Selected infrastructure

- Hetzner Cloud `cx23` in `nbg1`, provisioned by `infra/turn/terraform`.
- Arch Linux installed automatically through Hetzner Rescue and `installimage`.
- Stable public IPv4 and matching Hetzner/nftables firewalls.
- DNS `A` record: `turn.mixhive.app` directly to the VPS. Do not proxy it.
- Key-only SSH on port `22`; root SSH is disabled after bootstrap.
- Podman/Quadlet, OpenSSL, Certbot, nftables, and Coturn utilities.

## Provision and bootstrap

Export a Hetzner project token locally and run the reproducible bootstrap:

```bash
export HCLOUD_TOKEN='<hetzner-project-token>'
./infra/turn/bootstrap.sh
```

Review the Terraform plan before accepting it. The script creates the Hetzner server,
provider firewall, and SSH key; installs Arch through Rescue; hardens the host; and
generates `/etc/mixhive/coturn.env` only on the VPS.

At the printed checkpoint, manually create:

```text
turn.mixhive.app A <server_ipv4> TTL 300
```

The record must be DNS-only/unproxied. After public DNS resolves, activate the relay:

```bash
./infra/turn/activate-turn.sh
```

Activation obtains TLS, installs the renewal hook, starts Coturn, and verifies all three
selected transports.

## Vercel production configuration

From the linked MixHive Vercel project, configure the server-side production variables
without writing the TURN secret to disk:

```bash
./infra/turn/configure-vercel.sh
```

The script sets the following values with issuance disabled first. Never create
`NEXT_PUBLIC_TURN_*` variables.

```text
TURN_CREDENTIALS_ENABLED=false
TURN_SHARED_SECRET=<same secret as /etc/mixhive/coturn.env>
TURN_URLS=turn:turn.mixhive.app:3478?transport=udp,turn:turn.mixhive.app:3478?transport=tcp,turns:turn.mixhive.app:5349?transport=tcp
TURN_CREDENTIAL_TTL_SECONDS=21600
```

Deploy MixHive after updating Vercel. Confirm direct/STUN fallback remains healthy, then
set `TURN_CREDENTIALS_ENABLED=true`, deploy again, and run the authenticated
separate-network browser test. The endpoint deliberately returns `503` while disabled.

## Verification

Install `turnutils_uclient` from the VPS distribution's Coturn package, load the secret,
and run:

```bash
sudo bash -c 'set -a; source /etc/mixhive/coturn.env; set +a; /usr/local/sbin/mixhive-verify-turn'
```

This verifies UDP `3478`, TCP `3478`, and TLS `5349`. Then run a two-creator browser
test from separate networks and confirm a `relay` ICE candidate in browser WebRTC
internals. An audience account must never receive credentials or creator audio.

Monitor:

```bash
systemctl status mixhive-coturn.service
journalctl -u mixhive-coturn.service --since today
certbot certificates
systemctl status mixhive-turn-healthcheck.timer mixhive-certbot-renew.timer
```

Run `sudo pacman -Syu` during a planned monthly maintenance window, reboot when the
kernel changes, and rerun the transport verification. Review Coturn release notes and
update the immutable image digest in `worker/coturn/mixhive-coturn.container` during a
planned maintenance window; never switch production back to an unpinned `latest` tag.

## Quarterly signing-secret rotation

Rotation causes active creator talkback connections to reconnect once. Synchronized
public previews remain available.

1. Announce a short talkback maintenance window.
2. Set Vercel `TURN_CREDENTIALS_ENABLED=false` and deploy.
3. On the VPS run `sudo /usr/local/sbin/mixhive-rotate-turn-secret`.
4. Run `./infra/turn/configure-vercel.sh` locally and deploy.
5. Run `sudo bash -c 'set -a; source /etc/mixhive/coturn.env; set +a;
   /usr/local/sbin/mixhive-verify-turn'` on the VPS.
6. Set `TURN_CREDENTIALS_ENABLED=true`, deploy, and run the two-creator browser check.
7. Securely delete `/etc/mixhive/coturn.env.previous`.

For incident response, disable issuance immediately, rotate the secret, and inspect
Coturn logs and VPS bandwidth before re-enabling.
