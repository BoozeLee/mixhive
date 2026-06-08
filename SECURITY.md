# Security Policy

## Reporting a Vulnerability

I take security seriously. If you discover a security vulnerability, please report it privately rather than opening a public issue.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Private Reporting

- **GitHub Security Advisory**: Use the [Private Vulnerability Reporting](https://github.com/BoozeLee/mixhive/security/advisories/new) feature.
- **Email**: Send details to [your security email] with `SECURITY` in the subject line.
- **Signal/Encrypted**: Available upon request for highly sensitive findings.

### What to Include

- Description of the vulnerability and potential impact
- Steps to reproduce or proof-of-concept
- Affected versions/commits
- Suggested fix (if available)

### Process

1. You submit a report via one of the channels above
2. I acknowledge within 48 hours
3. I investigate and determine impact
4. A fix is developed and tested
5. A security advisory is published (credit given unless you prefer anonymity)
6. A patch release is issued

### Scope

- Main branch and recent releases
- Configuration files, CI/CD workflows, API endpoints
- Dependency chains and supply chain risks

### Out of Scope

- Issues already reported publicly
- Vulnerabilities in forked or archived repositories
- Social engineering attacks
- DOS attacks

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Security Best Practices

- All dependencies are monitored via Dependabot
- CodeQL static analysis runs on every PR and weekly
- Secret scanning with push protection is enabled
- Workflows use least-privilege permissions
- Actions are pinned to commit SHAs where possible

## Advisory Tracking

`npm audit` is expected to report **0 vulnerabilities** on `main`; CI/reviewers should
treat a regression here as a blocker. When a transitive advisory has no clean upstream
fix, prefer a pinned `overrides` entry in `package.json` over `npm audit fix --force`
(which can force breaking major downgrades). Current overrides and why:

- `ws` → `^8.21.0` — patches the `ws` uninitialized-memory advisory (GHSA-58qx-3vcg-4xpx)
  that reached us via `ethers@6`, without downgrading `ethers`.
- `postcss` → `^8.5.15` — patches the PostCSS stringify XSS advisory (GHSA-qx2v-qp2m-jg93)
  in the copy bundled by `next`, without downgrading `next`.

Re-evaluate these overrides on each `next`/`ethers` major bump; drop them once the upstream
ranges no longer pull a vulnerable version.

## Database / RLS Notes

Authorization in SECURITY DEFINER RPCs is derived from `auth.uid()`, never from a
caller-supplied identity parameter — `review_verification_request` and
`review_moderation_signal` were both hardened to this rule (a trusted `p_reviewer_id`
parameter would have allowed privilege escalation). New admin/owner-gated RPCs must
follow the same pattern and `revoke execute ... from public, anon`.

**Known low-severity item (tracked):** the Stripe Connect columns added to `profiles`
in migration `084` (`stripe_account_id`, `payouts_enabled`, `charges_enabled`,
`connect_onboarding_state`) are readable through the table's public `select` policy via
`select('*')`. No secret keys are exposed (a Connect `acct_…` id is not a credential),
but the recommended hardening is to relocate these fields to a service-role-only
`stripe_accounts` table (or column-revoke + explicit column selects) so seller payment
state is not world-readable. Deferred to a dedicated change to avoid breaking the many
`profiles` `select('*')` read paths.
