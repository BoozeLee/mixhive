# MixHive TURN Infrastructure

This stack provisions `turn.mixhive.app` on Hetzner Cloud and installs Arch Linux
through Hetzner Rescue. Terraform creates the billable server and provider firewall.
Ansible installs and hardens Arch, then activates the Coturn Quadlet only after the
manual DNS checkpoint succeeds.

## Prerequisites

- A Hetzner Cloud project and read/write API token.
- Terraform 1.15+, Ansible 2.19+, `curl`, `jq`, OpenSSH, and the administrator key at
  `~/.ssh/id_ed25519.pub`.
- Access to the authoritative `mixhive.app` DNS dashboard.

## Provision and install Arch

```bash
export HCLOUD_TOKEN='<hetzner-project-token>'
./infra/turn/bootstrap.sh
```

Review the Terraform plan before accepting it. The script creates a protected `cx23` in
`nbg1`, enables Rescue with the configured SSH key, installs Arch using Hetzner
`installimage`, hardens key-only SSH, generates the TURN secret on the VPS, and stops at
the DNS checkpoint.

Create this manual DNS-only/unproxied record using the IPv4 printed by Terraform:

```text
turn.mixhive.app A <server_ipv4> TTL 300
```

## Activate TLS and Coturn

After public DNS resolves:

```bash
./infra/turn/activate-turn.sh
```

Activation obtains the Let's Encrypt certificate, starts the Coturn Quadlet, enables the
hourly transport health check, and verifies UDP `3478`, TCP `3478`, and TLS `5349`.

Configure the production Vercel variables without writing the TURN shared secret to disk:

```bash
./infra/turn/configure-vercel.sh
```

The script deliberately leaves `TURN_CREDENTIALS_ENABLED=false`. Redeploy and complete
the authenticated two-creator separate-network relay test before enabling issuance.

Follow `docs/TURN_RELAY_RUNBOOK.md` for the fail-closed Vercel cutover and quarterly
secret rotation. Never commit Terraform state, generated inventory, Hetzner tokens, or
the TURN shared secret.

The server has deletion and rebuild protection enabled. Disable those protections
explicitly in the Hetzner console before an intentional Terraform destroy or rebuild.

Validate all infrastructure definitions without creating a server:

```bash
./infra/turn/validate.sh
```
