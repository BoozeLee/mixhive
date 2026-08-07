---
description: Run a full dependency audit on MixHive
---

Run the following checks and summarize findings:

1. `npm audit --audit-level moderate`
2. `npm outdated --json`
3. `git diff package-lock.json` (if dirty)
4. `git diff package.json` (if dirty)

Report:
- High/critical vulnerabilities with fix versions
- Outdated dependencies grouped by risk
- Lockfile drift status

Do not apply fixes unless explicitly asked.
