-- Subscriptions / plans (built 2026-07-28).
--
-- Three plans mirror the pricing page: free (default) | pro | premium.
-- Free caps reset each CALENDAR MONTH (UTC); paid caps are also monthly. Usage
-- is DERIVED (submitted attempts + open sessions this month) — there is no
-- counter to increment or reset. Enforcement is server-side in the edge
-- functions (start-session gates; get-entitlements reports), never trusted from
-- the browser — the same rule as answer keys and roles.
--
-- SECURITY: exactly the column-grant model of 0005_roles / 0009_onboarding —
-- users may update ONLY their own name + onboarding columns. The plan columns
-- are deliberately NOT granted to `authenticated`, so a student can never
-- upgrade themselves; plans change EXCLUSIVELY through the admin-users edge
-- function (service_role), which a super_admin drives from /admin/users.

alter table public.profiles
  add column if not exists plan text not null default 'free'
    check (plan in ('free', 'pro', 'premium')),
  -- When a paid plan lapses. NULL = no expiry (free, or an open-ended grant).
  -- Expiry is resolved on READ (an expired paid plan is treated as free); no
  -- background job flips the row, so this stays whatever the admin set.
  add column if not exists plan_expires_at timestamptz,
  -- How the plan was granted: 'admin' today (manual grant). Room for
  -- 'checkout'/'code'/'signup' once billing exists.
  add column if not exists plan_source text,
  add column if not exists plan_updated_at timestamptz,
  add column if not exists plan_updated_by uuid references auth.users(id) on delete set null;

-- (No `grant update (...)` for the plan columns — that is what keeps them
--  service_role-only. Do NOT add them to any authenticated grant.)

-- Audit trail: every plan change the admin makes, for support/history.
create table if not exists public.plan_changes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  from_plan   text,
  to_plan     text not null,
  expires_at  timestamptz,
  changed_by  uuid references auth.users(id) on delete set null,
  note        text,
  created_at  timestamptz not null default now()
);

create index if not exists plan_changes_user_idx
  on public.plan_changes (user_id, created_at desc);

-- RLS on, NO policies: only the service_role (admin-users edge function) reads
-- or writes this table — the same pattern as test_content.
alter table public.plan_changes enable row level security;
