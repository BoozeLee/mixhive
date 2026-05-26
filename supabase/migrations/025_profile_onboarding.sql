-- Migration 025: Profile onboarding — wizard completion flag + DJ tool fields.
--
-- The new AI-powered profile setup wizard (/setup) needs three things:
--   1. A flag so the app knows whether to redirect a fresh signup to /setup
--      instead of /feed (onboarding_complete).
--   2. Arrays for DJ hardware and software so GPT can write a more specific
--      bio and so the profile card can surface the creator's toolchain.
--   3. A free-text style field that feeds DALL-E 3 avatar generation and the
--      GPT bio prompt without forcing the user into a rigid taxonomy.
--
-- All columns default to a safe value so existing rows are unaffected.
-- No RLS changes needed — the existing "Users can update own profile" policy
-- already covers these columns.
--
-- Resolves: AI-powered profile setup wizard (025)

begin;

alter table public.profiles
  add column if not exists onboarding_complete boolean not null default false,
  add column if not exists dj_equipment        text[]  not null default '{}',
  add column if not exists dj_daw              text[]  not null default '{}',
  add column if not exists dj_style            text;

-- Existing accounts are treated as already onboarded so they never get
-- redirected to the wizard on next login.
update public.profiles
set onboarding_complete = true
where onboarding_complete = false;

-- dj_style length guard — same pattern as 010 for description.
alter table public.profiles
  drop constraint if exists profiles_dj_style_length,
  add  constraint profiles_dj_style_length
    check (dj_style is null or char_length(dj_style) <= 500) not valid;
alter table public.profiles validate constraint profiles_dj_style_length;

commit;

-- Resolves: AI-powered profile setup wizard (025)
