-- Cefrly phase 1 schema.
--
-- Security model:
--   * tests         -> metadata only. Authenticated users can read published rows.
--   * test_content  -> the full test JSON including answers & explanations.
--                      RLS enabled with NO policies: only the service_role key
--                      (edge functions) can ever read it. The browser gets tests
--                      exclusively through the get-test edge function, which
--                      strips every answer/explanation field.
--   * attempts      -> written only by the submit-test edge function
--                      (service_role); users can read their own rows.

create extension if not exists "pgcrypto";

create table public.tests (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  skill         text not null default 'reading' check (skill in ('reading')),
  target_levels text[] not null default '{B1,B2,C1}',
  duration_sec  integer not null default 3600,
  published     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.test_content (
  test_id    uuid primary key references public.tests(id) on delete cascade,
  content    jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  test_id    uuid not null references public.tests(id) on delete cascade,
  answers    jsonb not null,
  raw_score  integer not null,
  total      integer not null,
  band       text not null check (band in ('C1', 'B2', 'B1', 'below_B1')),
  result     jsonb not null,
  created_at timestamptz not null default now()
);

create index attempts_user_id_idx on public.attempts (user_id, created_at desc);

alter table public.tests enable row level security;
alter table public.test_content enable row level security;
alter table public.attempts enable row level security;

-- Catalog listing: metadata of published tests only.
create policy "authenticated users read published tests"
  on public.tests for select
  to authenticated
  using (published);

-- test_content: intentionally NO policies. service_role only.

-- attempts: owners can read their history. No insert/update/delete policies —
-- rows are created exclusively by the submit-test edge function.
create policy "users read own attempts"
  on public.attempts for select
  to authenticated
  using (auth.uid() = user_id);
