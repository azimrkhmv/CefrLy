-- Onboarding v2: collect the student's name + surname, swap the exam-month
-- picker for a coarser prep-timeframe bucket, and allow C2 as a self-assessed
-- level and a goal.
--
-- C2 is ASPIRATIONAL: the Multilevel exam scores only up to C1 (/35 thresholds
-- 28/18/10), so nothing is graded C2. We still let students say they're around
-- C2 or aiming for it — the dashboard treats a C2 goal as "beyond the ceiling".
--
-- SECURITY: same column-grant model as 0005_roles / 0009_onboarding — users may
-- write ONLY these onboarding columns (+ name); role stays locked to the
-- admin-users edge function. The CHECK constraints re-validate every value.

alter table public.profiles
  add column first_name      text check (char_length(first_name) <= 60),
  add column last_name       text check (char_length(last_name) <= 60),
  add column study_timeframe text
    check (study_timeframe in ('lt_1_month', '1_3_months', '3_6_months', 'no_date'));

-- Widen the existing self_level / target_band CHECKs to include C2. The columns
-- were added inline in 0009, so Postgres named the constraints
-- profiles_self_level_check / profiles_target_band_check.
alter table public.profiles drop constraint if exists profiles_self_level_check;
alter table public.profiles add constraint profiles_self_level_check
  check (self_level in ('unknown', 'below_B1', 'B1', 'B2', 'C1', 'C2'));

alter table public.profiles drop constraint if exists profiles_target_band_check;
alter table public.profiles add constraint profiles_target_band_check
  check (target_band in ('B1', 'B2', 'C1', 'C2'));

-- exam_month (from 0009) is left in place but no longer written by the wizard;
-- study_timeframe supersedes it. Kept nullable so nothing breaks.

grant update (first_name, last_name, study_timeframe)
  on table public.profiles to authenticated;
