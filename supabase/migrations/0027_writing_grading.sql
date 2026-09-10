-- Writing: graded attempts.
--
-- Writing papers are NOT rows in `tests` (they come from src/lib/writingFixtures
-- plus the student's own custom questions), so this table carries the paper's
-- identity as plain columns rather than a foreign key — exactly like
-- speaking_attempts, and for the same reason.
--
-- UNLIKE SPEAKING, WE KEEP WHAT THE STUDENT WROTE. A speaking attempt throws the
-- audio away because a recording of somebody's voice is not something to sit on;
-- an essay is text the student typed, it IS the record the feedback marks up,
-- and the report cannot render an inline correction without the sentence it
-- corrects. So `answers` is stored and stays.

create table if not exists public.writing_attempts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,

  -- Paper identity, denormalised: `writing-mock-1`, `w-t12-complaint`, or a
  -- custom prompt id. Title is stored so history survives a paper's removal.
  test_id text not null,
  test_title text not null,
  scope text not null default 'full' check (scope in ('full', 'part')),
  task_type text check (task_type in ('task_1_1', 'task_1_2', 'part_2')),

  status text not null default 'grading' check (status in ('grading', 'done', 'failed')),
  error_message text,

  -- The official maths: each task scores 0-9 on four criteria, is weighted
  -- (4 / 8 / 24 = 36 raw), and the raw total converts to a 0-75 rating.
  raw_score numeric(4, 1),
  rating integer,
  -- NULL for single-task drills: one task cannot produce a real /75 band, so
  -- drills show an ESTIMATE on screen that never enters the student's history.
  band text check (band in ('below_B1', 'B1', 'B2', 'C1')),

  -- What the student wrote: [{ taskId, taskType, taskLabel, text, wordCount }].
  -- The report highlights corrections inside these strings.
  answers jsonb not null default '[]'::jsonb,
  -- Everything the report renders: per-task bands, the four criteria, inline
  -- corrections, strengths, an improved version, the summary.
  result jsonb,

  -- Double-grade guard, same shape as speaking (migration 0024): WHEN the
  -- current run started, so a crashed run can still be retried once it goes
  -- stale, and HOW MANY runs this attempt has already cost.
  grading_started_at timestamptz,
  grading_runs integer not null default 0,

  created_at timestamptz not null default now(),
  graded_at timestamptz
);

create index if not exists writing_attempts_user_created_idx
  on public.writing_attempts (user_id, created_at desc);

-- Monthly plan-limit counting reads status + created_at for one user.
create index if not exists writing_attempts_user_status_idx
  on public.writing_attempts (user_id, status, created_at desc);

alter table public.writing_attempts enable row level security;

-- Students may READ their own attempts and nothing else. There is deliberately
-- no insert/update/delete policy: only the grade-writing edge function writes
-- here, with the service_role key, exactly like `attempts`, `speaking_attempts`
-- and `plan_changes`. A student cannot award themselves a band.
drop policy if exists "own writing attempts are readable" on public.writing_attempts;
create policy "own writing attempts are readable"
  on public.writing_attempts for select
  to authenticated
  using (auth.uid() = user_id);
