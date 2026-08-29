-- Let a student challenge an AI speaking score.
--
-- The grader is a model, and it will sometimes be wrong or harsh. Until now a
-- student had no way to say so: no button, no route to a human. This records
-- the complaint against the attempt so an admin can look at the transcript and
-- decide.
--
-- It deliberately does NOT re-run the AI. The recordings are deleted after
-- grading, so a second automatic pass would score the same transcript the same
-- way — the point is to reach a person.

create table if not exists public.speaking_recheck_requests (
  id uuid primary key default gen_random_uuid(),
  -- One request per attempt: a second complaint about the same score is the
  -- same complaint.
  attempt_id uuid not null unique
    references public.speaking_attempts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,

  reason text not null check (char_length(trim(reason)) between 10 and 2000),

  status text not null default 'open' check (status in ('open', 'reviewed', 'rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists speaking_recheck_status_idx
  on public.speaking_recheck_requests (status, created_at desc);

alter table public.speaking_recheck_requests enable row level security;

-- A student may raise a request against THEIR OWN graded attempt, and read
-- their own requests back. They may never edit one afterwards, and never see
-- anyone else's — status and admin_note are the admin's side of the
-- conversation, written only with the service_role key.
drop policy if exists "students raise their own recheck requests"
  on public.speaking_recheck_requests;
create policy "students raise their own recheck requests"
  on public.speaking_recheck_requests for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.speaking_attempts a
      where a.id = attempt_id
        and a.user_id = auth.uid()
        and a.status = 'done'
    )
  );

drop policy if exists "students read their own recheck requests"
  on public.speaking_recheck_requests;
create policy "students read their own recheck requests"
  on public.speaking_recheck_requests for select
  to authenticated
  using (user_id = auth.uid());
