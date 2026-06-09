-- Migration 091: storage RLS for mix-audio + mix-artwork
--
-- WHY: the mix-audio and mix-artwork buckets exist but carry no storage.objects
-- policies on the unified project, so authenticated uploads (Upload.tsx and the
-- new Beehive publish bridge → POST /api/mixes/publish) are RLS-denied. This adds
-- owner-scoped write + public read, mirroring the buzz-media pattern (owner = the
-- first path segment, i.e. uploads land under `${auth.uid()}/...`).
--
-- Resolves: Phase 15 (MixHive↔Beehive publish bridge) — 9969624782

begin;

do $$
declare b text;
begin
  foreach b in array array['mix-audio', 'mix-artwork'] loop
    execute format('drop policy if exists %I on storage.objects', b || ' public read');
    execute format($f$create policy %I on storage.objects for select using (bucket_id = %L)$f$,
                   b || ' public read', b);

    execute format('drop policy if exists %I on storage.objects', b || ' owner write');
    execute format($f$create policy %I on storage.objects for insert to authenticated
                     with check (bucket_id = %L and auth.uid()::text = (string_to_array(name, '/'))[1])$f$,
                   b || ' owner write', b);

    execute format('drop policy if exists %I on storage.objects', b || ' owner update');
    execute format($f$create policy %I on storage.objects for update to authenticated
                     using (bucket_id = %L and auth.uid()::text = (string_to_array(name, '/'))[1])
                     with check (bucket_id = %L and auth.uid()::text = (string_to_array(name, '/'))[1])$f$,
                   b || ' owner update', b, b);

    execute format('drop policy if exists %I on storage.objects', b || ' owner delete');
    execute format($f$create policy %I on storage.objects for delete to authenticated
                     using (bucket_id = %L and auth.uid()::text = (string_to_array(name, '/'))[1])$f$,
                   b || ' owner delete', b);
  end loop;
end $$;

commit;

-- Resolves: Phase 15 (MixHive↔Beehive publish bridge) — 9969624782
