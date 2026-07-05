-- Phase 3: Listening groundwork.
--   1) Allow skill = 'listening' on tests (was reading-only).
--   2) Two Storage buckets for listening media:
--        audio  -> recordings (per-part MP3s or one combined file)
--        images -> Part 4 map/plan images
--      Both are PUBLIC READ (students stream audio / display the map via public
--      URLs) but WRITE is restricted to admin / super_admin. Uploads therefore
--      only ever come from the admin surface; students never write media.

-- 1) skill constraint ---------------------------------------------------------
alter table public.tests drop constraint if exists tests_skill_check;
alter table public.tests
  add constraint tests_skill_check check (skill in ('reading', 'listening'));

-- Admin check used by the storage write policies below. SECURITY DEFINER so it
-- can read profiles.role regardless of the caller's own row-level access.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = uid and role in ('admin', 'super_admin')
  );
$$;

-- 2) buckets ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audio', 'audio', true), ('images', 'images', true)
on conflict (id) do update set public = excluded.public;

-- Public READ for both buckets.
drop policy if exists "listening media public read" on storage.objects;
create policy "listening media public read"
  on storage.objects for select
  using (bucket_id in ('audio', 'images'));

-- Admin-only WRITE (insert / update / delete).
drop policy if exists "listening media admin insert" on storage.objects;
create policy "listening media admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('audio', 'images') and public.is_admin(auth.uid()));

drop policy if exists "listening media admin update" on storage.objects;
create policy "listening media admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('audio', 'images') and public.is_admin(auth.uid()))
  with check (bucket_id in ('audio', 'images') and public.is_admin(auth.uid()));

drop policy if exists "listening media admin delete" on storage.objects;
create policy "listening media admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('audio', 'images') and public.is_admin(auth.uid()));
