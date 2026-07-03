-- MilliyMock hand-off support.
--
-- handoff_tokens: each hand-off JWT carries a unique jti; inserting it here is
-- what makes tokens single-use (primary key = second insert fails).
-- RLS with no policies: service_role (edge function) only.

create table public.handoff_tokens (
  jti     text primary key,
  used_at timestamptz not null default now()
);

alter table public.handoff_tokens enable row level security;

-- Look up an auth user id by email. GoTrue's admin API has no email filter, so
-- the edge function uses this instead. Locked down to service_role.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;
