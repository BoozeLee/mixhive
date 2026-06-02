-- Migration 037: make email/password signup resilient.
--
-- Fixes the generic "Database error saving new user" path by making the
-- auth.users -> public.profiles trigger tolerant of duplicate or malformed
-- usernames and by storing display_name from auth metadata when present.

begin;

-- Sanitize any raw username into a valid base slug.
create or replace function public.normalize_signup_username(raw_username text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  candidate := lower(coalesce(raw_username, ''));
  candidate := regexp_replace(candidate, '[^a-z0-9_]+', '_', 'g');
  candidate := regexp_replace(candidate, '_+', '_', 'g');
  candidate := trim(both '_' from candidate);

  if candidate is null or char_length(candidate) < 3 then
    candidate := 'user_' || substr(replace(user_id::text, '-', ''), 1, 8);
  end if;

  candidate := left(candidate, 30);
  candidate := regexp_replace(candidate, '_+$', '', 'g');

  if char_length(candidate) < 3 then
    candidate := 'user_' || substr(replace(user_id::text, '-', ''), 1, 8);
  end if;

  return candidate;
end;
$$;

-- Ensure the username is unique without failing signup.
create or replace function public.ensure_unique_signup_username(raw_username text, user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text := public.normalize_signup_username(raw_username, user_id);
  candidate text := base_name;
  suffix text;
  counter int := 0;
begin
  loop
    exit when not exists (
      select 1
      from public.profiles p
      where p.username = candidate
    );

    counter := counter + 1;
    suffix := '_' || substr(replace(user_id::text, '-', ''), 1, 4) || counter::text;
    candidate := left(base_name, greatest(3, 30 - char_length(suffix))) || suffix;

    exit when counter > 8;
  end loop;

  if char_length(candidate) < 3 then
    candidate := 'user_' || substr(replace(user_id::text, '-', ''), 1, 8);
  end if;

  return candidate;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_username text;
  raw_display_name text;
begin
  raw_username := coalesce(
    new.raw_user_meta_data ->> 'preferred_username',
    new.raw_user_meta_data ->> 'username',
    new.email
  );

  raw_display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.email
  );

  insert into public.profiles (
    id,
    username,
    display_name,
    avatar_url
  )
  values (
    new.id,
    public.ensure_unique_signup_username(raw_username, new.id),
    raw_display_name,
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  return new;
end;
$$;

commit;
