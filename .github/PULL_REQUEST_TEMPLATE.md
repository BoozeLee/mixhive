<!--
Thanks for contributing to MixHive! Please fill out the sections below.
Keep PRs small and focused — one logical change per PR.
-->

## Summary

<!-- What does this PR do? One or two sentences. -->

## Related Issues

<!-- Link issues this PR closes, e.g. "Closes #123" -->

## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would change existing behaviour)
- [ ] DB migration (adds a new file in `supabase/migrations/`)
- [ ] Refactor / cleanup (no behaviour change)
- [ ] Documentation
- [ ] CI / tooling

## Screenshots / Recordings

<!-- For UI changes, attach a before/after screenshot or a short clip. -->

## Test Plan

<!-- How did you verify this works? -->

- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Manually tested in dev browser
- [ ] If DB migration: applied locally and verified RLS still enforces correctly

## Checklist

- [ ] My code follows the patterns in `.github/copilot-instructions.md`
- [ ] I have not committed any secrets, `.env*` files, or service role keys
- [ ] I have updated `src/lib/types.ts` if I changed DB schema or RPC return shapes
- [ ] I have not disabled RLS or weakened any security policy
