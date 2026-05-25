# Contributing to MixHive

Thanks for working on MixHive. This repo is private during initial development; these notes are for internal contributors.

## Workflow

1. Branch from `main`: `git checkout -b feat/your-change` (or `fix/`, `chore/`, `docs/`)
2. Write code following the patterns in [`.github/copilot-instructions.md`](./copilot-instructions.md)
3. Run locally before pushing:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run build
   ```
4. Open a PR against `main`. Fill in the PR template.
5. Wait for CI to pass and at least one approving review.
6. Merge with **squash** or **rebase**. No merge commits.

## Commit Style

Conventional commits, lowercase, imperative:

```
feat(player): add queue reorder via drag
fix(upload): handle null artwork on retry
chore(deps): bump vite to 8.0.13
docs(readme): clarify supabase setup
```

Scopes mirror the area labels: `auth`, `feed`, `player`, `upload`, `social`, `notifications`, `playlists`, `search`, `profile`, `database`, `ui`, `ci`.

## Database Changes

- Add a new numbered file in `supabase/migrations/` (e.g. `007_my_change.sql`). Do not edit existing migrations.
- Update `src/lib/types.ts` if you changed a table or RPC shape.
- Never disable RLS. If your change requires a new policy, add it in the same migration.

## Don't

- Don't commit `.env*` files (except `.env.example`).
- Don't commit `secrets/`, service-role keys, OAuth client secrets, or any cloud credentials.
- Don't use `any` to silence TypeScript. Fix the underlying type.
- Don't introduce new dependencies without checking bundle impact.
- Don't squash unrelated changes into one PR.
