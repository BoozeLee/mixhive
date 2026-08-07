# Security Policy

## Reporting a Vulnerability

I take security seriously. If you discover a security vulnerability, please report it privately rather than opening a public issue.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### Private Reporting

- **GitHub Security Advisory**: Use the [Private Vulnerability Reporting](https://github.com/BoozeLee/mixhive/security/advisories/new) feature.
- **Email**: Send details to kiliaanv2@gmail.com with `SECURITY` in the subject line.
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

## Dependency Audit

Last full audit: 2026-08-07

| Date | Vulnerabilities | Fixed |
|------|-----------------|-------|
| 2026-08-07 | 17 (10 high, 5 moderate, 2 low) | 15 via `npm audit fix` |
| | Remaining: 2 high | React Router CSRF bypass — blocked by breaking change requirement |

### Automated Fixes Applied

`npm audit fix` updated 48 packages and removed 2 on 2026-08-07:

- `next` 16.2.7 → 16.3.0
- `react-router-dom` 7.15.1 → 7.18.2
- `postcss` 8.5.15 → 8.5.26
- `http-proxy-middleware` 3.0.5 → 3.0.7
- `form-data` 3.0.4 → 3.0.5
- `body-parser` 2.2.2 → 2.3.0
- `ethers` 6.16.0 → 6.17.0
- `js-yaml` 3.14.2 → 3.15.1
- `brace-expansion` 1.1.15 → 1.1.18
- `sharp` <0.35.0 → 0.35.3
- `@opentelemetry/*` → 2.10.0
- `@babel/core` → 7.29.7

### Remaining High Severity

React Router `7.12.0 - 8.2.0`: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response.

`npm audit fix --force` would downgrade `react-router-dom` to `7.11.0`, which is a breaking change. Defer until React Router v7.18.2 is confirmed not vulnerable, or until a minor bump resolves it.

### Remediation Policy

- Run `npm audit` at minimum once per sprint
- Apply `npm audit fix` immediately when it does not introduce breaking changes
- Document breaking-change fixes in a dedicated issue for the next maintenance window
- Pin critical runtime dependencies where semver ranges are too wide
