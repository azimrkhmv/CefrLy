-- Server-side timing: a session row records when a user started a test and
-- when it expires. Created/reused by get-test, closed by submit-test.
-- RLS with NO policies: sessions are managed exclusively by the edge
-- functions (service_role); the browser never touches this table.

create table public.test_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  test_id      uuid not null references public.tests(id) on delete cascade,
  started_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  submitted_at timestamptz,
  created_at   timestamptz not null default now()
);

create index test_sessions_lookup_idx
  on public.test_sessions (user_id, test_id, started_at desc);

alter table public.test_sessions enable row level security;

-- Link each graded attempt to the session it came from (audit trail).
alter table public.attempts
  add column session_id uuid references public.test_sessions(id);
