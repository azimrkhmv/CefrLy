-- Phase 2 Task 1: three roles on profiles.
-- student (default) | admin (content management) | super_admin (owner: + manage admins).
--
-- SECURITY: profiles had an "own profile update" RLS policy; with a role column
-- that would let users promote themselves. Column-level grants fix it: users
-- can update ONLY their name. Roles change exclusively via the admin-users
-- edge function (service_role).

alter table public.profiles add column role text not null default 'student'
  check (role in ('student', 'admin', 'super_admin'));

revoke update on table public.profiles from anon, authenticated;
grant update (name) on table public.profiles to authenticated;

-- Owner promotion (run once; adjust the email if the owner account changes):
-- update public.profiles set role = 'super_admin'
--   where id = (select id from auth.users where email = 'OWNER_EMAIL');
