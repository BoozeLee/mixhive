-- Migration 079: Hive Story editorial issues + features
--
-- Adds the monthly editorial showcase introduced in Phase 16.
-- Each issue (hive_story_issues) curates a set of featured artists,
-- mixes, collabs, or scenes (hive_story_features). Issues are created
-- by the team via service role (Supabase dashboard); the frontend only
-- reads published records. No operator action required before applying.
--
-- Resolves: Phase 16 — Hive Story editorial feature

begin;

create table if not exists hive_story_issues (
  id            uuid        primary key default gen_random_uuid(),
  slug          text        not null unique,
  title         text        not null,
  subtitle      text,
  theme_color   text        not null default '#f0c040',
  hero_image_url text,
  published_at  timestamptz,
  created_by    uuid        references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists hive_story_features (
  id             uuid        primary key default gen_random_uuid(),
  issue_id       uuid        not null references hive_story_issues(id) on delete cascade,
  profile_id     uuid        references profiles(id) on delete cascade,
  mix_id         uuid        references mixes(id) on delete cascade,
  feature_type   text        not null,
  headline       text        not null,
  body_text      text,
  order_position integer     not null default 0,
  created_at     timestamptz not null default now(),
  constraint hive_story_features_type_check
    check (feature_type in ('artist', 'mix', 'collab', 'scene')),
  constraint hive_story_features_has_subject
    check (profile_id is not null or mix_id is not null)
);

create index if not exists hive_story_issues_published_at_idx
  on hive_story_issues (published_at desc nulls last);

create index if not exists hive_story_features_issue_id_idx
  on hive_story_features (issue_id, order_position);

alter table hive_story_issues enable row level security;
alter table hive_story_features enable row level security;

drop policy if exists "hive_story_issues_select_published" on hive_story_issues;
create policy "hive_story_issues_select_published"
  on hive_story_issues for select
  using (published_at is not null and published_at <= now());

drop policy if exists "hive_story_features_select_published" on hive_story_features;
create policy "hive_story_features_select_published"
  on hive_story_features for select
  using (
    exists (
      select 1 from hive_story_issues i
      where i.id = issue_id
        and i.published_at is not null
        and i.published_at <= now()
    )
  );

commit;

-- Resolves: Phase 16 — Hive Story editorial feature
