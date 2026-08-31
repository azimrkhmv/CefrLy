-- Speaking grading: stop one attempt being graded twice, and cap runaway retries.
--
-- Until now the only short-circuit in grade-speaking was `status = 'done'`, so
-- two overlapping calls for the SAME attempt (the exam page's auto-send plus a
-- reload, or a double-tapped retry) both reached Gemini. That paid for the same
-- exam twice, and the run that finished first deleted the clips out from under
-- the one still reading them.
--
-- These two columns are what a guard needs: WHEN the current run started (so a
-- crashed run can still be retried after it goes stale) and HOW MANY runs this
-- attempt has already cost.

alter table public.speaking_attempts
  add column if not exists grading_started_at timestamptz,
  add column if not exists grading_runs integer not null default 0;

-- Backfill so existing rows read sensibly: a finished attempt was run at least
-- once, and its run began no later than the moment it was created.
update public.speaking_attempts
   set grading_runs = 1,
       grading_started_at = coalesce(grading_started_at, created_at)
 where grading_runs = 0
   and status in ('done', 'failed');

-- The "how many attempts did this user start in the last hour" check.
-- (user_id, created_at desc) already exists for history; this is the same shape,
-- so nothing new is needed there.
