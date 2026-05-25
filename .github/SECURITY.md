# Security Policy

## Supported Versions

MixHive is in active pre-release development. Only the `main` branch receives security updates.

| Version | Supported |
| --- | --- |
| main    | yes |
| other   | no  |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security reports.**

If you discover a vulnerability — exposed credentials, RLS bypass, auth flaw, data leak, XSS, CSRF, IDOR, or anything that could compromise user data — please report it privately:

1. Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository, **or**
2. Email the maintainer with the subject line `SECURITY: MixHive`.

Please include:

- A description of the issue and its impact
- Steps to reproduce (or a proof of concept)
- The version / commit SHA you tested against
- Your suggested remediation, if any

## Response Targets

- **Acknowledgement**: within 72 hours
- **Initial assessment**: within 7 days
- **Fix or mitigation**: depends on severity — critical issues prioritised same week

We will coordinate disclosure with the reporter and credit you in the advisory unless you prefer anonymity.

## Out of Scope

- Vulnerabilities in third-party dependencies (please report to the upstream maintainer; Dependabot tracks these here)
- Social engineering, phishing, or physical attacks
- Denial of service via volumetric traffic
- Issues in dev / staging environments
