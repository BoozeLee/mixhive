---
name: mixhive-migration
description: >
  REQUIRED when adding or scaffolding a Supabase migration in this repo.
  Triggers: "new migration", "add migration", "supabase migration",
  "schema change", "alter table", "create policy", "next migration number",
  any mention of `supabase/migrations/`, or numbers like 017, 018, 019…
  Use to enforce the project's idempotent / NOT-VALID-VALIDATE / commit-
  block conventions and to pick the next number correctly. Excludes
  editing existing migration files — those are immutable.
---

# MixHive migration skill

Every schema change ships as a **new numbered SQL file** in
`supabase/migrations/`. Existing files are immutable history — they are
the source of truth for what was deployed at each step.

## When this skill MUST be used

- Adding a table, column, index, policy, function, trigger, or seed.
- Backfilling data.
- Enabling or disabling a Postgres extension.
- Any RLS policy change.

## Layout

```sql
-- Migration NNN: short purpose
--
-- 3-6 lines explaining WHY this change exists, what problem it solves,
-- and any operator action needed before applying (extension enablement,
-- env vars, etc.).
--
-- Resolves: <issue or roadmap phase>

begin;

-- … DDL …

commit;
```

## Conventions

- **Filename**: `NNN_short_purpose.sql` — pad NNN to 3 digits. To find
  the next number: `ls supabase/migrations | tail -1 | head -c3`.
- **Idempotency** — every DDL statement is safe to re-run:
  - `create table if not exists …`
  - `drop policy if exists "…" on …;` before each `create policy …`
  - `drop trigger if exists … on …;` before each `create trigger …`
  - `do $$ begin … exception when duplicate_object then null; end$$;`
    for `alter publication … add table …`
- **CHECK constraints** added on existing tables: use
  `add constraint … check (…) not valid;` then
  `alter table … validate constraint …;` so existing rows surface
  clearly without blocking the migration.
- **Extension dependencies** (pg_cron, pg_net, pg_trgm) — guard with
  `do $$ begin if not exists (select 1 from pg_extension …) then
  raise exception 'Enable <extension> in the dashboard first'; end if; end$$;`.
- **Security-definer functions** — set `search_path = public` explicitly
  and revoke `from public` if not meant to be client-callable.
- **Down migrations**: not used. To reverse, write a new numbered
  migration that drops the offending objects.

## Migrations already in the repo (read these before extending)

```
001_mixhive_schema.sql        — core tables, RLS, triggers, seed genres
002_notification_triggers.sql — reply + mix_upload notifications
003_waveform_pipeline.sql     — DROPPED by 007 (transcode orphans)
004_feed_algorithm.sql        — mix_scores, get_trending_cursor, etc.
005_playlists.sql             — playlists + playlist_mixes + helpers
006_advanced_social.sql       — user_blocks, mentions, recommended DJs
007_cleanup_transcode_orphans — drop 003 dead code
008_enable_pg_cron_score_refresh — hourly mix_scores refresh
009_reposts_in_feed.sql       — feed UNION with reposts
010_rls_and_constraints.sql   — RLS gap fixes + CHECK constraints
011_get_comments_threaded.sql — single-query threaded comments
012_enable_replication.sql    — supabase_realtime publication
013_lua_agents.sql            — lua_agents + lua_agent_runs + dispatch
014_lua_more_triggers.sql     — on_like/repost/mention/upload/unfollow
015_lua_scheduled_agents.sql  — pg_cron-driven on_schedule dispatcher
016_lua_public_agents.sql     — is_public + fork_lua_agent RPC
```

## Footer convention

End the migration with `Resolves: <thing>` so commit messages can quote
the same line. Examples: `Resolves: Phase L+`, `Resolves: #2`,
`Resolves: backfill orphan reposts on prod`.
