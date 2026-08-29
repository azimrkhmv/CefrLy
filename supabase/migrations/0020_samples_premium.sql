-- Model answers become a paid feature (owner call 2026-08-30).
--
-- The samples library publishes a strong model answer for every writing and
-- speaking prompt. It was readable by any signed-in account; it is now part of
-- Pro and Premium.
--
-- Enforced in RLS, NOT in the UI. Hiding the page would leave the rows one
-- fetch away for anyone who opened the network tab — the browser reads this
-- table directly (a sample has no answer key to protect, so unlike `tests` it
-- never went through an edge function).

-- Mirrors hasPremiumAccess() in src/lib/plans.ts: a paid plan that has not
-- lapsed, or staff. SECURITY DEFINER so it can read `profiles` while the
-- calling user is restricted by that table's own policies.
create or replace function public.has_premium_access(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and (
        p.role in ('admin', 'super_admin')
        or (
          p.plan in ('pro', 'premium')
          and (p.plan_expires_at is null or p.plan_expires_at > now())
        )
      )
  );
$$;

comment on function public.has_premium_access(uuid) is
  'True when the account may use paid features (unexpired Pro/Premium, or staff). Mirrors hasPremiumAccess() in src/lib/plans.ts.';

drop policy if exists "students read published samples" on public.samples;

create policy "paid students read published samples"
  on public.samples for select
  to authenticated
  using (status = 'published' and public.has_premium_access(auth.uid()));
