-- Answers-so-far, on the server.
--
-- Until now an in-progress attempt lived ONLY in the browser's localStorage.
-- That is fast and works offline, but it means: answers exist on exactly one
-- device, a cleared cache loses them, and — the reason this table exists — the
-- server has nothing to grade when a simulation's clock runs out with the tab
-- closed. The exam stays local-first (every keystroke still saves instantly in
-- the browser); this is a background copy, a few seconds behind.
--
-- One row per session. The student's own answers are not a secret, so the row
-- is written by the browser directly under RLS rather than through an edge
-- function — but only for a session that is THEIRS and still open.

create table if not exists public.session_answers (
  session_id uuid primary key references public.test_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- itemId -> typed value, exactly the shape submit-test grades.
  answers jsonb not null default '{}'::jsonb,
  -- itemId -> marked-for-review, so a resume on another device keeps the flags.
  marked jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists session_answers_user_idx
  on public.session_answers (user_id, updated_at desc);

alter table public.session_answers enable row level security;

-- Own + still-open sessions only. There is deliberately NO delete policy: rows
-- are cleared by submit-test / the expiry sweep with the service_role key, so a
-- student can never erase the evidence of what they had written.
drop policy if exists "students write their own in-progress answers" on public.session_answers;
create policy "students write their own in-progress answers"
  on public.session_answers for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id and s.user_id = auth.uid() and s.submitted_at is null
    )
  );

drop policy if exists "students update their own in-progress answers" on public.session_answers;
create policy "students update their own in-progress answers"
  on public.session_answers for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.test_sessions s
      where s.id = session_id and s.user_id = auth.uid() and s.submitted_at is null
    )
  )
  with check (user_id = auth.uid());

drop policy if exists "students read their own in-progress answers" on public.session_answers;
create policy "students read their own in-progress answers"
  on public.session_answers for select
  to authenticated
  using (user_id = auth.uid());
