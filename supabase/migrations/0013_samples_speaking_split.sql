-- Speaking samples split into the four real Multilevel parts.
--
-- Speaking used to live under ONE `speaking` category, its parts distinguished
-- only by the badge text. It now mirrors the writing split — each part is its
-- own category so the /samples page can tab through them:
--   Part 1.1 interview        -> speaking1_1
--   Part 1.2 photo comparison -> speaking1_2
--   Part 2   photo talk       -> speaking2
--   Part 3   for/against      -> speaking3
--
-- APPLY ORDER on a live DB (the new CHECK rejects rows still on bare
-- 'speaking', so re-categorize BEFORE swapping the constraint):
--   1. UPDATE public.samples SET category = '<new>' for every speaking row
--      (or just re-run supabase/seed/samples-seed.sql, which now carries the
--       four new categories and upserts by slug), THEN
--   2. run this migration.

alter table public.samples drop constraint if exists samples_category_check;

alter table public.samples
  add constraint samples_category_check
  check (category in (
    'writing1_1', 'writing1_2', 'writing2',
    'speaking1_1', 'speaking1_2', 'speaking2', 'speaking3'
  ));
