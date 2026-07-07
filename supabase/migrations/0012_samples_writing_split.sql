-- Writing samples split into the three real Multilevel tasks.
--
-- The old writing1/writing2 fixtures were fabricated (apology letters, essays,
-- a chart-description) and did not match the real exam. Writing is now:
--   Part 1 shares ONE scenario → Task 1.1 (informal email, B1) + Task 1.2
--   (formal email, B2); Part 2 is a forum post / article (C1).
-- Speaking is unchanged (one tab; samples badged Part 1.1/1.2/2/3).
--
-- All old rows are fixture data and are replaced by real content in
-- supabase/seed/samples-seed.sql, so the CHECK constraint is simply swapped.
-- (Apply order on a live DB: delete old rows, run this, then re-seed.)

alter table public.samples drop constraint if exists samples_category_check;

alter table public.samples
  add constraint samples_category_check
  check (category in ('writing1_1', 'writing1_2', 'writing2', 'speaking'));
