-- Single-part tests ("practice by part"): a test can now be either the FULL
-- mock paper or exactly ONE canonical part of it (same rigid per-part layout
-- and counts, validated in admin-tests). Part tests power the Part 1..N tabs
-- in the catalog; they always run as auto-started practice with the test's
-- own duration (no mode picker).
--
-- Part attempts carry NO CEFR band: bands are defined by thresholds out of 35
-- on the full paper, so attempts.band becomes nullable (the existing CHECK
-- already passes NULL by SQL semantics; only NOT NULL had to go).

alter table public.tests
  add column scope text not null default 'full' check (scope in ('full', 'part')),
  add column part_number integer check (part_number between 1 and 6);

alter table public.tests add constraint tests_part_scope check (
  (scope = 'full' and part_number is null)
  or (scope = 'part' and part_number is not null)
);

alter table public.attempts alter column band drop not null;
